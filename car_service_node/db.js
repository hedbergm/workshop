import { JSONFileSync } from 'lowdb/node';
import { LowSync } from 'lowdb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = process.env.DATA_DIR || __dirname;
try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
const dbPath = path.join(baseDir, 'database.json');
const adapter = new JSONFileSync(dbPath);
export const db = new LowSync(adapter, { vehicles: [], service_entries: [], owners: [], _seq: 1 });
db.read();
if (!db.data) db.data = { vehicles: [], service_entries: [], owners: [], _seq: 1 };
// Backward-compat: ensure arrays exist and correct types
if (!Array.isArray(db.data.vehicles)) db.data.vehicles = [];
if (!Array.isArray(db.data.service_entries)) db.data.service_entries = [];
if (!Array.isArray(db.data.owners)) db.data.owners = [];
db.write();

function nextId() {
  const cur = Number.isFinite(db.data._seq) ? db.data._seq : 0;
  db.data._seq = cur + 1;
  return db.data._seq;
}

export function getAllVehicles() {
  db.read();
  const list = Array.isArray(db.data.vehicles) ? db.data.vehicles : [];
  return list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function insertVehicle(v) {
  db.read();
  if (!Array.isArray(db.data.vehicles)) db.data.vehicles = [];
  const exists = db.data.vehicles.find(x => x.regnr === v.regnr);
  if (exists) throw new Error('UNIQUE constraint failed: vehicles.regnr');
  const row = {
    id: nextId(),
    ...v,
    owner_id: v.owner_id != null && v.owner_id !== '' ? Number(v.owner_id) : null,
    sale_price: null,
    sold_date: null,
    created_at: new Date().toISOString(),
  };
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
  const list = Array.isArray(db.data.service_entries) ? db.data.service_entries : [];
  return list
    .filter(e => e.vehicle_id === Number(vehicle_id))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}

export function insertEntry(e) {
  db.read();
  if (!Array.isArray(db.data.service_entries)) db.data.service_entries = [];
  const row = { id: nextId(), ...e };
  db.data.service_entries.push(row);
  db.write();
  return row;
}

export function getTotalCost(vehicle_id) {
  db.read();
  const list = Array.isArray(db.data.service_entries) ? db.data.service_entries : [];
  return list
    .filter(e => e.vehicle_id === Number(vehicle_id))
    .reduce((s, e) => s + Number(e.cost || 0), 0);
}

// Owners
export function getAllOwners() {
  db.read();
  const owners = Array.isArray(db.data.owners) ? db.data.owners : [];
  return owners.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export function insertOwner(o) {
  db.read();
  if (!Array.isArray(db.data.owners)) db.data.owners = [];
  const row = { id: nextId(), name: String(o.name || '').trim() };
  if (!row.name) throw new Error('Navn er påkrevd');
  db.data.owners.push(row);
  db.write();
  return row;
}

export function getOwner(id) {
  db.read();
  return db.data.owners.find(o => o.id === Number(id));
}
