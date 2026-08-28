import { NextResponse } from 'next/server';
import fs from 'node:fs';import path from 'node:path';
import { setComponentImage, uploadsDir } from '@/lib/db';
import { errorMessage } from '@/lib/validation';
export const runtime='nodejs';
const allowed=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/gif','gif']]);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const form=await request.formData();const file=form.get('image');if(!(file instanceof File))throw new Error('Choose an image to upload.');if(file.size>5*1024*1024)throw new Error('Images must be smaller than 5 MB.');const ext=allowed.get(file.type);if(!ext)throw new Error('Use a JPG, PNG, WebP, or GIF image.');const filename=`${id}.${ext}`;fs.writeFileSync(path.join(uploadsDir,filename),Buffer.from(await file.arrayBuffer()));return NextResponse.json(setComponentImage(id,filename));}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json(setComponentImage(id,null));}catch(e){return NextResponse.json({error:errorMessage(e)},{status:400});}}
