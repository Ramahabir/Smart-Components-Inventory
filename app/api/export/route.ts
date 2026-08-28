import { createBackup } from '@/lib/backup';export const runtime='nodejs';
export async function GET(){const stamp=new Date().toISOString().slice(0,10);return new Response(createBackup(),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="smart-storage-${stamp}.zip"`}});}
