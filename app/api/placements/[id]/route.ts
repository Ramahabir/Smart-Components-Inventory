import { NextResponse } from 'next/server';
import { deletePlacement } from '@/lib/db';
import { errorMessage } from '@/lib/validation';
export const runtime='nodejs';
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;deletePlacement(id);return new NextResponse(null,{status:204});}catch(e){return NextResponse.json({error:errorMessage(e)},{status:404});}}
