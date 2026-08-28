import { NextResponse } from 'next/server';
import Fuse from 'fuse.js';
import { getLocation, listComponents } from '@/lib/db';
export const runtime='nodejs';
export async function GET(request:Request){
  const {searchParams}=new URL(request.url);const q=(searchParams.get('q')||'').trim(),category=searchParams.get('category')||'',location=searchParams.get('location')||'';
  let items=listComponents();if(category)items=items.filter(i=>i.category===category);if(location){const selected=getLocation(location);items=items.filter(i=>i.placements.some(p=>p.locationId===location||(selected&&p.locationPath.startsWith(`${selected.path} → `))));}
  if(q){const searchable=items.map(i=>({...i,specText:i.specifications.map(s=>`${s.key} ${s.value}`).join(' '),locationText:i.placements.map(p=>p.locationPath).join(' ')}));const fuse=new Fuse(searchable,{threshold:.38,ignoreLocation:true,includeScore:true,keys:[{name:'name',weight:.34},{name:'aliases',weight:.24},{name:'partNumber',weight:.17},{name:'category',weight:.1},{name:'manufacturer',weight:.06},{name:'specText',weight:.06},{name:'notes',weight:.02},{name:'locationText',weight:.01}]});items=fuse.search(q).map(r=>({...r.item,score:r.score}));}
  return NextResponse.json(items);
}
