import { NextResponse } from 'next/server';
import { deleteComponent, getComponent, updateComponent } from '@/lib/db';
import { componentInput, errorMessage } from '@/lib/validation';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const item=getComponent(id);return item?NextResponse.json(item):NextResponse.json({error:'Component not found.'},{status:404});}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json(updateComponent(id,componentInput.parse(await request.json())));}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;deleteComponent(id);return new NextResponse(null,{status:204});}catch(e){return NextResponse.json({error:errorMessage(e)},{status:409});}}
