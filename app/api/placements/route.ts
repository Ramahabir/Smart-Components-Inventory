import { NextResponse } from 'next/server';
import { upsertPlacement } from '@/lib/db';
import { errorMessage, placementInput } from '@/lib/validation';
export const runtime='nodejs';
export async function POST(request:Request){try{return NextResponse.json(upsertPlacement(placementInput.parse(await request.json())),{status:201});}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
