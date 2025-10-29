import express from 'express';
import session from 'express-session';
import expressLayouts from 'express-ejs-layouts';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, getAllVehicles, insertVehicle, getVehicle, setSalePrice, getEntries, insertEntry, getTotalCost } from './db.js';

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

app.get('/vehicles', loginRequired, (req, res) => {
  const vehicles = getAllVehicles();
  const totals = Object.fromEntries(vehicles.map(v => [v.id, getTotalCost(v.id)]));
  res.render('vehicles', { vehicles, totals, user: req.session.user });
});

app.get('/vehicles/new', loginRequired, (req, res) => {
  res.render('vehicle_new', { user: req.session.user, error: null });
});

app.post('/vehicles/new', loginRequired, (req, res) => {
  try {
    const v = {
      regnr: String(req.body.regnr || '').trim().toUpperCase(),
      make: String(req.body.make || '').trim(),
      vtype: String(req.body.vtype || '').trim(),
      model: String(req.body.model || '').trim(),
      purchase_price: req.body.purchase_price ? Number(req.body.purchase_price) : null,
    };
    insertVehicle(v);
    res.redirect('/vehicles');
  } catch (err) {
    let msg = 'Kunne ikke registrere bil';
    if (String(err).includes('UNIQUE constraint failed')) msg = 'Regnr er allerede registrert';
    res.status(400).render('vehicle_new', { user: req.session.user, error: msg });
  }
});

app.get('/vehicles/:id', loginRequired, (req, res) => {
  const id = Number(req.params.id);
  const v = getVehicle(id);
  if (!v) return res.sendStatus(404);
  const entries = getEntries(id);
  const totalCost = getTotalCost(id);
  res.render('vehicle_detail', { v, entries, totalCost, user: req.session.user });
});

app.post('/vehicles/:id/add_entry', loginRequired, (req, res) => {
  const id = Number(req.params.id);
  const v = getVehicle(id);
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
    insertEntry(e);
    res.redirect(`/vehicles/${id}`);
  } catch (err) {
    res.status(400).send('Kunne ikke legge til oppføring: ' + err);
  }
});

app.post('/vehicles/:id/sell', loginRequired, (req, res) => {
  const id = Number(req.params.id);
  const v = getVehicle(id);
  if (!v) return res.sendStatus(404);
  try {
    const price = req.body.sale_price ? Number(req.body.sale_price) : null;
    setSalePrice(id, price);
    res.redirect(`/vehicles/${id}`);
  } catch (err) {
    res.status(400).send('Kunne ikke oppdatere utsalgspris: ' + err);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server lytter på http://127.0.0.1:${PORT}`));
