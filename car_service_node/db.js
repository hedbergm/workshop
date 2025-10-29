// Conditional DB backend: dynamically import Postgres if DATABASE_URL is set, otherwise LowDB (JSON file)
let impl;
if (process.env.DATABASE_URL) {
	impl = await import('./db_pg.js');
} else {
	impl = await import('./db_lowdb.js');
}

try {
	const backendName = impl.backend || 'unknown';
	const extra = impl.info && impl.info.dbPath ? ` (file: ${impl.info.dbPath})` : '';
	console.log(`[db] backend=${backendName}${extra}`);
} catch {}

export const getAllVehicles = impl.getAllVehicles;
export const insertVehicle = impl.insertVehicle;
export const getVehicle = impl.getVehicle;
export const setSalePrice = impl.setSalePrice;
export const getEntries = impl.getEntries;
export const insertEntry = impl.insertEntry;
export const getTotalCost = impl.getTotalCost;
export const getAllOwners = impl.getAllOwners;
export const insertOwner = impl.insertOwner;
export const getOwner = impl.getOwner;
export const updateVehicle = impl.updateVehicle;
export const updateOwner = impl.updateOwner;
