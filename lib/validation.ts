import { z } from 'zod';
import { LOCATION_TYPES } from './types';

export const componentInput = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(100).default(''),
  aliases: z.array(z.string().trim().min(1).max(100)).default([]),
  manufacturer: z.string().trim().max(120).default(''),
  partNumber: z.string().trim().max(120).default(''),
  specifications: z.array(z.object({ key: z.string().trim().min(1).max(80), value: z.string().trim().max(200) })).default([]),
  notes: z.string().trim().max(4000).default(''),
});

export const locationInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(LOCATION_TYPES),
  code: z.string().trim().max(60).default(''),
  parentId: z.string().uuid().nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
  sortOrder: z.number().int().min(0).default(0),
});

export const placementInput = z.object({
  componentId: z.string().uuid(), locationId: z.string().uuid(),
  quantity: z.number().finite().min(0), unit: z.string().trim().min(1).max(30).default('pcs'),
});

export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((i) => i.message).join(', ');
  return error instanceof Error ? error.message : 'Something went wrong.';
}
