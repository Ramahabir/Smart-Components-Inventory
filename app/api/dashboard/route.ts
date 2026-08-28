import { NextResponse } from 'next/server';
import { listComponents, stats } from '@/lib/db';
export const runtime='nodejs';
export async function GET(){try{const components=listComponents();return NextResponse.json({stats:stats(),recent:components.slice(0,6),categories:[...new Set(components.map(c=>c.category).filter(Boolean))].sort()});}catch(e){console.error(e);return NextResponse.json({error:'Dashboard is temporarily unavailable.'},{status:500});}}
