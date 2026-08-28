import { NextResponse } from 'next/server';
import { createComponent, listComponents } from '@/lib/db';
import { componentInput, errorMessage } from '@/lib/validation';
export const runtime='nodejs';
export async function GET(){try{return NextResponse.json(listComponents());}catch(e){console.error(e);return NextResponse.json({error:'Inventory is temporarily unavailable.'},{status:500});}}
export async function POST(request:Request){try{const input=componentInput.parse(await request.json());return NextResponse.json(createComponent(input),{status:201});}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
