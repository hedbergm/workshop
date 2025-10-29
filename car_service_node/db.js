import { JSONFileSync } from 'lowdb/node';
import { LowSync } from 'lowdb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.json');
const adapter = new JSONFileSync(dbPath);
export const db = new LowSync(adapter, { vehicles: [], service_entries: [], _seq: 1 });
db.read();
if (!db.data) db.data = { vehicles: [], service_entries: [], _seq: 1 };

function nextId() {
  db.data._seq = (db.data._seq || 1) + 1;
  return db.data._seq;
}

export function getAllVehicles() {
  db.read();
  return [...db.data.vehicles].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function insertVehicle(v) {
  db.read();
  const exists = db.data.vehicles.find(x => x.regnr === v.regnr);
  if (exists) throw new Error('UNIQUE constraint failed: vehicles.regnr');
  const row = { id: nextId(), sale_price: null, sold_date: null, created_at: new Date().toISOString(), ...v };
  db.data.vehicles.push(row);
  db.write();
  return row;
}

export function getVehicle(id) {
  db.read();
  return db.data.vehicles.find(v => v.id === Number(id));
}

export function setSalePrice(id, sale_price) {
  db.read();
  const v = db.data.vehicles.find(x => x.id === Number(id));
  if (!v) return null;
  v.sale_price = sale_price;
  v.sold_date = new Date().toISOString();
  db.write();
  return v;
}

export function getEntries(vehicle_id) {
  db.read();
  return db.data.service_entries
    .filter(e => e.vehicle_id === Number(vehicle_id))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}

export function insertEntry(e) {
  db.read();
  const row = { id: nextId(), ...e };
  db.data.service_entries.push(row);
  db.write();
  return row;
}

export function getTotalCost(vehicle_id) {
  db.read();
  return db.data.service_entries
    .filter(e => e.vehicle_id === Number(vehicle_id))
    .reduce((s, e) => s + Number(e.cost || 0), 0);
}
