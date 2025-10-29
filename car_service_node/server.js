import express from 'express';
import session from 'express-session';
import expressLayouts from 'express-ejs-layouts';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllVehicles, insertVehicle, getVehicle, setSalePrice, getEntries, insertEntry, getTotalCost, getAllOwners, insertOwner, getOwner, updateVehicle, updateOwner } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
// Serve logo from the neighboring Flask project folder (read-only)
app.use('/assets', express.static(path.join(__dirname, '..', 'car_service_app')));

app.use(
  session({
    secret: 'dev-secret-change',
    resave: false,
    saveUninitialized: false,
  })
);

function loginRequired(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

app.get('/', (req, res) => {
  res.render('login', { error: null });
});

app.post('/', (req, res) => {
  const { username, password } = req.body;
  if (username === 'Admin' && password === 'Admin') {
    req.session.user = 'Admin';
    return res.redirect('/vehicles');
  }
  res.render('login', { error: 'Feil brukernavn eller passord' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/vehicles', loginRequired, async (req, res) => {
  const ownerId = req.query.owner_id && req.query.owner_id !== 'none' ? Number(req.query.owner_id) : null;
  const selectedUnowned = req.query.unowned === '1' || req.query.owner_id === 'none';
  const [vehicles, owners] = await Promise.all([getAllVehicles(), getAllOwners()]);
  let filtered = vehicles;
  let ownerName = null;
  if (selectedUnowned) {
    filtered = vehicles.filter(v => v.owner_id == null);
  } else if (ownerId) {
    filtered = vehicles.filter(v => Number(v.owner_id) === ownerId);
    const foundOwner = owners.find(o => o.id === ownerId);
    ownerName = foundOwner ? foundOwner.name : null;
  } else {
    filtered = [];
  }
  res.render('vehicles', { vehicles: filtered, owners, selectedOwnerId: ownerId, selectedUnowned, ownerName, user: req.session.user });
});

app.get('/vehicles/new', loginRequired, async (req, res) => {
  const owners = await getAllOwners();
  res.render('vehicle_new', { user: req.session.user, error: null, owners });
});

app.post('/vehicles/new', loginRequired, async (req, res) => {
  try {
    const v = {
      regnr: String(req.body.regnr || '').trim().toUpperCase(),
      make: String(req.body.make || '').trim(),
      vtype: String(req.body.vtype || '').trim(),
      model: String(req.body.model || '').trim(),
      purchase_price: req.body.purchase_price ? Number(req.body.purchase_price) : null,
      owner_id: req.body.owner_id ? Number(req.body.owner_id) : null,
    };
    await insertVehicle(v);
    res.redirect('/vehicles');
  } catch (err) {
    let msg = 'Kunne ikke registrere bil';
    if (String(err).includes('UNIQUE constraint failed')) msg = 'Regnr er allerede registrert';
    const owners = await getAllOwners();
    res.status(400).render('vehicle_new', { user: req.session.user, error: msg, owners });
  }
});

app.get('/vehicles/:id', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const v = await getVehicle(id);
  if (!v) return res.sendStatus(404);
  const [entries, totalCost] = await Promise.all([getEntries(id), getTotalCost(id)]);
  res.render('vehicle_detail', { v, entries, totalCost, user: req.session.user });
});

app.post('/vehicles/:id/add_entry', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const v = await getVehicle(id);
  if (!v) return res.sendStatus(404);
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const e = {
      vehicle_id: id,
      date,
      category: req.body.category || 'service',
      description: String(req.body.description || '').trim(),
      cost: Number(req.body.cost || 0),
      odometer: Number(req.body.odometer || 0),
    };
    await insertEntry(e);
    res.redirect(`/vehicles/${id}`);
  } catch (err) {
    res.status(400).send('Kunne ikke legge til oppføring: ' + err);
  }
});

app.post('/vehicles/:id/sell', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const v = await getVehicle(id);
  if (!v) return res.sendStatus(404);
  try {
    const price = req.body.sale_price ? Number(req.body.sale_price) : null;
    await setSalePrice(id, price);
    res.redirect(`/vehicles/${id}`);
  } catch (err) {
    res.status(400).send('Kunne ikke oppdatere utsalgspris: ' + err);
  }
});

// Edit vehicle
app.get('/vehicles/:id/edit', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const v = await getVehicle(id);
  if (!v) return res.sendStatus(404);
  const owners = await getAllOwners();
  res.render('vehicle_edit', { v, owners, user: req.session.user, error: null });
});

app.post('/vehicles/:id/edit', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const v = await getVehicle(id);
  if (!v) return res.sendStatus(404);
  try {
    await updateVehicle(id, {
      owner_id: req.body.owner_id,
      regnr: req.body.regnr,
      make: req.body.make,
      vtype: req.body.vtype,
      model: req.body.model,
      purchase_price: req.body.purchase_price,
    });
    res.redirect('/vehicles?owner_id=' + (req.body.owner_id || ''));
  } catch (err) {
    const owners = await getAllOwners();
    const msg = String(err).includes('UNIQUE constraint failed') ? 'Regnr er allerede registrert' : String(err);
    res.status(400).render('vehicle_edit', { v, owners, user: req.session.user, error: msg });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server lytter på http://127.0.0.1:${PORT}`));

// Owners
app.get('/owners', loginRequired, async (req, res) => {
  const owners = await getAllOwners();
  res.render('owners', { owners, user: req.session.user, error: null });
});

app.get('/owners/new', loginRequired, (req, res) => {
  res.render('owner_new', { user: req.session.user, error: null });
});

app.post('/owners/new', loginRequired, async (req, res) => {
  try {
    await insertOwner({ name: req.body.name });
    res.redirect('/owners');
  } catch (err) {
    res.status(400).render('owner_new', { user: req.session.user, error: String(err) });
  }
});

app.get('/owners/:id/edit', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const o = await getOwner(id);
  if (!o) return res.sendStatus(404);
  res.render('owner_edit', { o, user: req.session.user, error: null });
});

app.post('/owners/:id/edit', loginRequired, async (req, res) => {
  const id = Number(req.params.id);
  const o = await getOwner(id);
  if (!o) return res.sendStatus(404);
  try {
    await updateOwner(id, { name: req.body.name });
    res.redirect('/owners');
  } catch (err) {
    res.status(400).render('owner_edit', { o, user: req.session.user, error: String(err) });
  }
});
