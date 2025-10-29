import pg from 'pg';

// Use DATABASE_URL (Render injects this). Force SSL for managed Postgres.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.LOCAL_PG_NO_SSL ? { rejectUnauthorized: false } : undefined,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        regnr TEXT NOT NULL UNIQUE,
        make TEXT,
        vtype TEXT,
        model TEXT,
        purchase_price NUMERIC,
        owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
        sale_price NUMERIC,
        sold_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_entries (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        category TEXT,
        description TEXT,
        date DATE,
        cost NUMERIC DEFAULT 0,
        odometer INTEGER
      );
    `);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Kick off migrations on first import
await migrate();
export const backend = 'postgres';

// Helpers
const num = (v) => (v === '' || v == null ? null : Number(v));
const intOrNull = (v) => (v === '' || v == null ? null : Number(v));
const upper = (s) => (s == null ? null : String(s).trim().toUpperCase());

export async function getAllVehicles() {
  const { rows } = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
  return rows.map(mapVehicle);
}

export async function insertVehicle(v) {
  const regnr = upper(v.regnr);
  const make = v.make != null ? String(v.make).trim() : null;
  const vtype = v.vtype != null ? String(v.vtype).trim() : null;
  const model = v.model != null ? String(v.model).trim() : null;
  const purchase_price = num(v.purchase_price);
  const owner_id = intOrNull(v.owner_id);
  try {
    const { rows } = await pool.query(
      `INSERT INTO vehicles (regnr, make, vtype, model, purchase_price, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [regnr, make, vtype, model, purchase_price, owner_id]
    );
    return mapVehicle(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      // unique_violation
      throw new Error('UNIQUE constraint failed: vehicles.regnr');
    }
    throw e;
  }
}

export async function getVehicle(id) {
  const { rows } = await pool.query('SELECT * FROM vehicles WHERE id = $1', [Number(id)]);
  return rows[0] ? mapVehicle(rows[0]) : null;
}

export async function setSalePrice(id, sale_price) {
  const { rows } = await pool.query(
    `UPDATE vehicles SET sale_price = $2, sold_date = NOW() WHERE id = $1 RETURNING *`,
    [Number(id), num(sale_price)]
  );
  return rows[0] ? mapVehicle(rows[0]) : null;
}

export async function getEntries(vehicle_id) {
  const { rows } = await pool.query(
    `SELECT * FROM service_entries WHERE vehicle_id = $1 ORDER BY date DESC NULLS LAST, id DESC`,
    [Number(vehicle_id)]
  );
  return rows.map(mapEntry);
}

export async function insertEntry(e) {
  const { rows } = await pool.query(
    `INSERT INTO service_entries (vehicle_id, category, description, date, cost, odometer)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [Number(e.vehicle_id), e.category || null, e.description || null, e.date || null, num(e.cost) || 0, intOrNull(e.odometer)]
  );
  return mapEntry(rows[0]);
}

export async function getTotalCost(vehicle_id) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost), 0) AS total FROM service_entries WHERE vehicle_id = $1`,
    [Number(vehicle_id)]
  );
  const v = rows[0];
  return v ? Number(v.total) : 0;
}

// Owners
export async function getAllOwners() {
  const { rows } = await pool.query('SELECT * FROM owners ORDER BY name ASC');
  return rows.map(mapOwner);
}

export async function insertOwner(o) {
  const name = String(o.name || '').trim();
  if (!name) throw new Error('Navn er påkrevd');
  const { rows } = await pool.query('INSERT INTO owners (name) VALUES ($1) RETURNING *', [name]);
  return mapOwner(rows[0]);
}

export async function getOwner(id) {
  const { rows } = await pool.query('SELECT * FROM owners WHERE id = $1', [Number(id)]);
  return rows[0] ? mapOwner(rows[0]) : null;
}

// Updates
export async function updateVehicle(id, patch) {
  const existing = await getVehicle(id);
  if (!existing) return null;
  const merged = {
    ...existing,
    ...(patch.regnr !== undefined ? { regnr: upper(patch.regnr) } : {}),
    ...(patch.make !== undefined ? { make: String(patch.make).trim() } : {}),
    ...(patch.vtype !== undefined ? { vtype: String(patch.vtype).trim() } : {}),
    ...(patch.model !== undefined ? { model: String(patch.model).trim() } : {}),
    ...(patch.purchase_price !== undefined ? { purchase_price: num(patch.purchase_price) } : {}),
    ...(patch.owner_id !== undefined ? { owner_id: intOrNull(patch.owner_id) } : {}),
  };
  try {
    const { rows } = await pool.query(
      `UPDATE vehicles
         SET regnr=$2, make=$3, vtype=$4, model=$5, purchase_price=$6, owner_id=$7
       WHERE id=$1
       RETURNING *`,
      [Number(id), merged.regnr, merged.make, merged.vtype, merged.model, merged.purchase_price, merged.owner_id]
    );
    return rows[0] ? mapVehicle(rows[0]) : null;
  } catch (e) {
    if (e.code === '23505') {
      throw new Error('UNIQUE constraint failed: vehicles.regnr');
    }
    throw e;
  }
}

export async function updateOwner(id, patch) {
  const existing = await getOwner(id);
  if (!existing) return null;
  if (patch.name != null) {
    const name = String(patch.name).trim();
    if (!name) throw new Error('Navn er påkrevd');
    const { rows } = await pool.query('UPDATE owners SET name=$2 WHERE id=$1 RETURNING *', [Number(id), name]);
    return rows[0] ? mapOwner(rows[0]) : null;
  }
  return existing;
}

// Mappers to normalize types
function mapVehicle(r) {
  return {
    id: Number(r.id),
    regnr: r.regnr,
    make: r.make || '',
    vtype: r.vtype || '',
    model: r.model || '',
    purchase_price: r.purchase_price == null ? null : Number(r.purchase_price),
    owner_id: r.owner_id == null ? null : Number(r.owner_id),
    sale_price: r.sale_price == null ? null : Number(r.sale_price),
    sold_date: r.sold_date || null,
    created_at: r.created_at || null,
  };
}

function mapEntry(r) {
  return {
    id: Number(r.id),
    vehicle_id: Number(r.vehicle_id),
    category: r.category || 'service',
    description: r.description || '',
    date: r.date ? r.date.toISOString().slice(0, 10) : null,
    cost: r.cost == null ? 0 : Number(r.cost),
    odometer: r.odometer == null ? null : Number(r.odometer),
  };
}

function mapOwner(r) {
  return { id: Number(r.id), name: r.name };
}
