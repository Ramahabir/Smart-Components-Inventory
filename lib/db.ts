import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { ComponentRecord, LocationRecord, Specification, StockPlacement } from './types';

const dataDir = process.env.SMART_STORAGE_DATA_DIR || path.join(process.cwd(), 'data');
export const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'smart-storage.db'));
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
db.exec(`
CREATE TABLE IF NOT EXISTS components (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', aliases TEXT NOT NULL DEFAULT '[]',
 manufacturer TEXT NOT NULL DEFAULT '', part_number TEXT NOT NULL DEFAULT '', specifications TEXT NOT NULL DEFAULT '[]',
 notes TEXT NOT NULL DEFAULT '', image_filename TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS locations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, code TEXT NOT NULL DEFAULT '', parent_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
 notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_placements (
 id TEXT PRIMARY KEY, component_id TEXT NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
 location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT, quantity REAL NOT NULL CHECK(quantity >= 0),
 unit TEXT NOT NULL DEFAULT 'pcs', updated_at TEXT NOT NULL, UNIQUE(component_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_components_updated_at ON components(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON locations(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_parent_name ON locations(IFNULL(parent_id, ''), name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_stock_component_id ON stock_placements(component_id);
CREATE INDEX IF NOT EXISTS idx_stock_location_id ON stock_placements(location_id);
`);
db.pragma('optimize');

type Row = Record<string, unknown>;
const safeJson = <T>(value: unknown, fallback: T): T => { try { return JSON.parse(String(value)) as T; } catch { return fallback; } };

export function locationPath(id: string): string {
  const names: string[] = []; const seen = new Set<string>(); let current: string | null = id;
  while (current && !seen.has(current)) { seen.add(current); const row = db.prepare('SELECT name, parent_id FROM locations WHERE id = ?').get(current) as Row | undefined; if (!row) break; names.unshift(String(row.name)); current = row.parent_id ? String(row.parent_id) : null; }
  return names.join(' → ');
}

function mapPlacement(row: Row): StockPlacement { return { id:String(row.id), componentId:String(row.component_id), locationId:String(row.location_id), quantity:Number(row.quantity), unit:String(row.unit), locationPath:locationPath(String(row.location_id)), updatedAt:String(row.updated_at) }; }
export function listPlacements(componentId: string): StockPlacement[] { return (db.prepare('SELECT * FROM stock_placements WHERE component_id = ? ORDER BY updated_at DESC').all(componentId) as Row[]).map(mapPlacement); }
function mapComponent(row: Row): ComponentRecord { const placements=listPlacements(String(row.id)); return { id:String(row.id), name:String(row.name), category:String(row.category), aliases:safeJson<string[]>(row.aliases,[]), manufacturer:String(row.manufacturer), partNumber:String(row.part_number), specifications:safeJson<Specification[]>(row.specifications,[]), notes:String(row.notes), imageUrl:row.image_filename ? `/api/images/${encodeURIComponent(String(row.image_filename))}` : null, createdAt:String(row.created_at), updatedAt:String(row.updated_at), totalQuantity:placements.reduce((n,p)=>n+p.quantity,0), placements }; }
export function listComponents(limit?: number): ComponentRecord[] { const sql=`SELECT * FROM components ORDER BY updated_at DESC${limit ? ' LIMIT ?' : ''}`; return ((limit ? db.prepare(sql).all(limit) : db.prepare(sql).all()) as Row[]).map(mapComponent); }
export function getComponent(id: string): ComponentRecord | null { const row=db.prepare('SELECT * FROM components WHERE id=?').get(id) as Row|undefined; return row?mapComponent(row):null; }

export function createComponent(input: {name:string;category:string;aliases:string[];manufacturer:string;partNumber:string;specifications:Specification[];notes:string}) { const id=crypto.randomUUID(), now=new Date().toISOString(); db.prepare(`INSERT INTO components (id,name,category,aliases,manufacturer,part_number,specifications,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,input.name,input.category,JSON.stringify(input.aliases),input.manufacturer,input.partNumber,JSON.stringify(input.specifications),input.notes,now,now); return getComponent(id)!; }
export function updateComponent(id:string,input:{name:string;category:string;aliases:string[];manufacturer:string;partNumber:string;specifications:Specification[];notes:string}) { const now=new Date().toISOString(); const result=db.prepare(`UPDATE components SET name=?,category=?,aliases=?,manufacturer=?,part_number=?,specifications=?,notes=?,updated_at=? WHERE id=?`).run(input.name,input.category,JSON.stringify(input.aliases),input.manufacturer,input.partNumber,JSON.stringify(input.specifications),input.notes,now,id); if(!result.changes) throw new Error('Component not found.'); return getComponent(id)!; }
export function deleteComponent(id:string) { const count=(db.prepare('SELECT COUNT(*) count FROM stock_placements WHERE component_id=?').get(id) as Row).count as number; if(count>0) throw new Error('Remove this component from all locations before deleting it.'); const row=db.prepare('SELECT image_filename FROM components WHERE id=?').get(id) as Row|undefined; const result=db.prepare('DELETE FROM components WHERE id=?').run(id); if(!result.changes) throw new Error('Component not found.'); if(row?.image_filename) fs.rmSync(path.join(uploadsDir,String(row.image_filename)),{force:true}); }

function mapLocation(row:Row): LocationRecord { const id=String(row.id); const componentCount=Number((db.prepare('SELECT COUNT(*) count FROM stock_placements WHERE location_id=?').get(id) as Row).count); const childCount=Number((db.prepare('SELECT COUNT(*) count FROM locations WHERE parent_id=?').get(id) as Row).count); return {id,name:String(row.name),type:String(row.type) as LocationRecord['type'],code:String(row.code),parentId:row.parent_id?String(row.parent_id):null,notes:String(row.notes),sortOrder:Number(row.sort_order),path:locationPath(id),componentCount,childCount}; }
export function listLocations():LocationRecord[]{return (db.prepare('SELECT * FROM locations ORDER BY parent_id, sort_order, name COLLATE NOCASE').all() as Row[]).map(mapLocation);}
export function getLocation(id:string):LocationRecord|null{const row=db.prepare('SELECT * FROM locations WHERE id=?').get(id) as Row|undefined;return row?mapLocation(row):null;}
export function createLocation(input:{name:string;type:string;code:string;parentId:string|null;notes:string;sortOrder:number}){const id=crypto.randomUUID(),now=new Date().toISOString();if(input.parentId&&!getLocation(input.parentId))throw new Error('Parent location not found.');db.prepare('INSERT INTO locations (id,name,type,code,parent_id,notes,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,input.name,input.type,input.code,input.parentId,input.notes,input.sortOrder,now,now);return getLocation(id)!;}
function isDescendant(id:string,parentId:string|null){let current=parentId;const seen=new Set<string>();while(current&&!seen.has(current)){if(current===id)return true;seen.add(current);const row=db.prepare('SELECT parent_id FROM locations WHERE id=?').get(current) as Row|undefined;current=row?.parent_id?String(row.parent_id):null;}return false;}
export function updateLocation(id:string,input:{name:string;type:string;code:string;parentId:string|null;notes:string;sortOrder:number}){if(input.parentId===id||isDescendant(id,input.parentId))throw new Error('A location cannot be moved inside itself or one of its children.');const now=new Date().toISOString();const result=db.prepare('UPDATE locations SET name=?,type=?,code=?,parent_id=?,notes=?,sort_order=?,updated_at=? WHERE id=?').run(input.name,input.type,input.code,input.parentId,input.notes,input.sortOrder,now,id);if(!result.changes)throw new Error('Location not found.');return getLocation(id)!;}
export function deleteLocation(id:string){const row=getLocation(id);if(!row)throw new Error('Location not found.');if(row.childCount||row.componentCount)throw new Error('Move or remove this location’s contents and child locations before deleting it.');db.prepare('DELETE FROM locations WHERE id=?').run(id);}

export function upsertPlacement(input:{componentId:string;locationId:string;quantity:number;unit:string}){if(!getComponent(input.componentId))throw new Error('Component not found.');if(!getLocation(input.locationId))throw new Error('Location not found.');const existing=db.prepare('SELECT id FROM stock_placements WHERE component_id=? AND location_id=?').get(input.componentId,input.locationId) as Row|undefined;const id=existing?String(existing.id):crypto.randomUUID(),now=new Date().toISOString();db.prepare(`INSERT INTO stock_placements(id,component_id,location_id,quantity,unit,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(component_id,location_id) DO UPDATE SET quantity=excluded.quantity,unit=excluded.unit,updated_at=excluded.updated_at`).run(id,input.componentId,input.locationId,input.quantity,input.unit,now);return mapPlacement(db.prepare('SELECT * FROM stock_placements WHERE id=?').get(id) as Row);}
export function deletePlacement(id:string){const result=db.prepare('DELETE FROM stock_placements WHERE id=?').run(id);if(!result.changes)throw new Error('Placement not found.');}
export function setComponentImage(id:string,filename:string|null){const old=db.prepare('SELECT image_filename FROM components WHERE id=?').get(id) as Row|undefined;if(!old)throw new Error('Component not found.');db.prepare('UPDATE components SET image_filename=?,updated_at=? WHERE id=?').run(filename,new Date().toISOString(),id);if(old.image_filename&&old.image_filename!==filename)fs.rmSync(path.join(uploadsDir,String(old.image_filename)),{force:true});return getComponent(id)!;}
export function stats(){return {components:Number((db.prepare('SELECT COUNT(*) count FROM components').get() as Row).count),locations:Number((db.prepare('SELECT COUNT(*) count FROM locations').get() as Row).count),placements:Number((db.prepare('SELECT COUNT(*) count FROM stock_placements').get() as Row).count)};}
export { db, dataDir };
