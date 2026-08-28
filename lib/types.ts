export const LOCATION_TYPES = ['room', 'cabinet', 'shelf', 'drawer', 'bin', 'box', 'other'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export interface Specification { key: string; value: string }
export interface ComponentRecord {
  id: string; name: string; category: string; aliases: string[]; manufacturer: string;
  partNumber: string; specifications: Specification[]; notes: string; imageUrl: string | null;
  createdAt: string; updatedAt: string; totalQuantity: number; placements: StockPlacement[];
}
export interface LocationRecord {
  id: string; name: string; type: LocationType; code: string; parentId: string | null;
  notes: string; sortOrder: number; path: string; componentCount: number; childCount: number;
}
export interface StockPlacement {
  id: string; componentId: string; locationId: string; quantity: number; unit: string;
  locationPath: string; updatedAt: string;
}
export interface SearchResult extends ComponentRecord { score?: number }
