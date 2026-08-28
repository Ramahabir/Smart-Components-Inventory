import AdmZip from 'adm-zip';
import Papa from 'papaparse';
import fs from 'node:fs';
import path from 'node:path';
import { db, uploadsDir } from './db';

type CsvRow=Record<string,string>;
const rows=(sql:string)=>db.prepare(sql).all() as CsvRow[];
export function createBackup(){
 const zip=new AdmZip();
 zip.addFile('components.csv',Buffer.from(Papa.unparse(rows('SELECT id,name,category,aliases,manufacturer,part_number,specifications,notes,image_filename,created_at,updated_at FROM components'))));
 zip.addFile('locations.csv',Buffer.from(Papa.unparse(rows('SELECT id,name,type,code,parent_id,notes,sort_order,created_at,updated_at FROM locations'))));
 zip.addFile('stock.csv',Buffer.from(Papa.unparse(rows('SELECT id,component_id,location_id,quantity,unit,updated_at FROM stock_placements'))));
 for(const filename of fs.readdirSync(uploadsDir)){const file=path.join(uploadsDir,filename);if(fs.statSync(file).isFile())zip.addLocalFile(file,'images');}
 return zip.toBuffer();
}

function parseCsv(text:string){const result=Papa.parse<CsvRow>(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim()});return {data:result.data,errors:result.errors.map(e=>`Row ${(e.row??0)+2}: ${e.message}`)};}
function typeFrom(rows:CsvRow[]){const keys=Object.keys(rows[0]||{});if(keys.includes('component_id'))return 'stock';if(keys.includes('parent_id')&&keys.includes('type'))return 'locations';if(keys.includes('name')&&keys.includes('aliases'))return 'components';return 'unknown';}
export interface ImportPreview{components:CsvRow[];locations:CsvRow[];stock:CsvRow[];errors:string[];images:{name:string;data:Buffer}[];}
export function inspectImport(filename:string,buffer:Buffer):ImportPreview{
 const out:ImportPreview={components:[],locations:[],stock:[],errors:[],images:[]};
 if(filename.toLowerCase().endsWith('.zip')){let zip:AdmZip;try{zip=new AdmZip(buffer);}catch{throw new Error('The backup ZIP could not be opened.');}for(const name of ['components.csv','locations.csv','stock.csv']){const entry=zip.getEntry(name);if(!entry){out.errors.push(`${name} is missing.`);continue;}const parsed=parseCsv(entry.getData().toString('utf8'));out.errors.push(...parsed.errors);if(name==='components.csv')out.components=parsed.data;if(name==='locations.csv')out.locations=parsed.data;if(name==='stock.csv')out.stock=parsed.data;}for(const entry of zip.getEntries())if(entry.entryName.startsWith('images/')&&!entry.isDirectory)out.images.push({name:path.basename(entry.entryName),data:entry.getData()});}
 else {const parsed=parseCsv(buffer.toString('utf8'));out.errors.push(...parsed.errors);const type=typeFrom(parsed.data);if(type==='unknown')out.errors.push('CSV columns do not match components, locations, or stock.');else out[type]=parsed.data;}
 validate(out);return out;
}
function validate(p:ImportPreview){
 const componentIds=new Set((db.prepare('SELECT id FROM components').all() as {id:string}[]).map(r=>r.id));const locationIds=new Set((db.prepare('SELECT id FROM locations').all() as {id:string}[]).map(r=>r.id));
 const seenComponents=new Set<string>();const seenLocations=new Set<string>();const seenStock=new Set<string>();
 p.components.forEach((r,i)=>{if(!r.id)r.id=crypto.randomUUID();if(seenComponents.has(r.id))p.errors.push(`components.csv row ${i+2}: duplicate ID.`);seenComponents.add(r.id);if(!r.name?.trim())p.errors.push(`components.csv row ${i+2}: name is required.`);componentIds.add(r.id);try{JSON.parse(r.aliases||'[]');JSON.parse(r.specifications||'[]');}catch{p.errors.push(`components.csv row ${i+2}: aliases or specifications contain invalid JSON.`);}});
 p.locations.forEach((r,i)=>{if(!r.id)r.id=crypto.randomUUID();if(seenLocations.has(r.id))p.errors.push(`locations.csv row ${i+2}: duplicate ID.`);seenLocations.add(r.id);if(!r.name?.trim())p.errors.push(`locations.csv row ${i+2}: name is required.`);if(!['room','cabinet','shelf','drawer','bin','box','other'].includes(r.type))p.errors.push(`locations.csv row ${i+2}: invalid type.`);locationIds.add(r.id);});
 p.locations.forEach((r,i)=>{if(r.parent_id&&!locationIds.has(r.parent_id))p.errors.push(`locations.csv row ${i+2}: parent location does not exist.`);});
 const parentById=new Map(p.locations.map(r=>[r.id,r.parent_id||null]));for(const [id] of parentById){const visited=new Set<string>();let current:string|null=id;while(current&&parentById.has(current)){if(visited.has(current)){p.errors.push(`locations.csv: hierarchy contains a cycle involving ${id}.`);break;}visited.add(current);current=parentById.get(current)||null;}}
 p.stock.forEach((r,i)=>{if(!r.id)r.id=crypto.randomUUID();if(seenStock.has(r.id))p.errors.push(`stock.csv row ${i+2}: duplicate ID.`);seenStock.add(r.id);const placementKey=`${r.component_id}:${r.location_id}`;if(seenStock.has(placementKey))p.errors.push(`stock.csv row ${i+2}: duplicate component/location placement.`);seenStock.add(placementKey);if(!componentIds.has(r.component_id))p.errors.push(`stock.csv row ${i+2}: component does not exist.`);if(!locationIds.has(r.location_id))p.errors.push(`stock.csv row ${i+2}: location does not exist.`);const q=Number(r.quantity);if(!Number.isFinite(q)||q<0)p.errors.push(`stock.csv row ${i+2}: quantity must be zero or greater.`);});
}
export function commitImport(p:ImportPreview){if(p.errors.length)throw new Error('Fix the import errors before committing.');const now=new Date().toISOString();db.transaction(()=>{
 const c=db.prepare(`INSERT INTO components(id,name,category,aliases,manufacturer,part_number,specifications,notes,image_filename,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,aliases=excluded.aliases,manufacturer=excluded.manufacturer,part_number=excluded.part_number,specifications=excluded.specifications,notes=excluded.notes,image_filename=excluded.image_filename,updated_at=excluded.updated_at`);
 for(const r of p.components)c.run(r.id,r.name,r.category||'',r.aliases||'[]',r.manufacturer||'',r.part_number||'',r.specifications||'[]',r.notes||'',r.image_filename||null,r.created_at||now,r.updated_at||now);
 const l=db.prepare(`INSERT INTO locations(id,name,type,code,parent_id,notes,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,code=excluded.code,parent_id=excluded.parent_id,notes=excluded.notes,sort_order=excluded.sort_order,updated_at=excluded.updated_at`);
 const pending=[...p.locations];let guard=pending.length+1;while(pending.length&&guard--){let wrote=false;for(let i=pending.length-1;i>=0;i--){const r=pending[i];if(!r.parent_id||db.prepare('SELECT 1 FROM locations WHERE id=?').get(r.parent_id)){l.run(r.id,r.name,r.type,r.code||'',r.parent_id||null,r.notes||'',Number(r.sort_order)||0,r.created_at||now,r.updated_at||now);pending.splice(i,1);wrote=true;}}if(!wrote)throw new Error('Location hierarchy contains a cycle.');}
 const s=db.prepare(`INSERT INTO stock_placements(id,component_id,location_id,quantity,unit,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(component_id,location_id) DO UPDATE SET quantity=excluded.quantity,unit=excluded.unit,updated_at=excluded.updated_at`);for(const r of p.stock)s.run(r.id,r.component_id,r.location_id,Number(r.quantity),r.unit||'pcs',r.updated_at||now);
 })();for(const image of p.images)fs.writeFileSync(path.join(uploadsDir,path.basename(image.name)),image.data);return {components:p.components.length,locations:p.locations.length,stock:p.stock.length,images:p.images.length};}
