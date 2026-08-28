import { NextResponse } from 'next/server';
import { createLocation, listLocations } from '@/lib/db';
import { errorMessage, locationInput } from '@/lib/validation';
export const runtime='nodejs';
export async function GET(){try{return NextResponse.json(listLocations());}catch(e){console.error(e);return NextResponse.json({error:'Locations are temporarily unavailable.'},{status:500});}}
export async function POST(request:Request){try{return NextResponse.json(createLocation(locationInput.parse(await request.json())),{status:201});}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
