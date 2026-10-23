export interface Product {
  id: string;
  ozonProductId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  ozonCardPrice: number;
  stocks: number;
  addedAt: string;
  lastUpdatedAt: string;
  soldUnits: number;
  rating: number;
  reviewCount: number;
  history: ProductSnapshot[];
}

export interface ProductSnapshot {
  id: number;
  capturedAt: string;
  price: number;
  ozonCardPrice: number;
  stocks: number;
  soldUnits: number;
  rating: number;
  reviewCount: number;
}
