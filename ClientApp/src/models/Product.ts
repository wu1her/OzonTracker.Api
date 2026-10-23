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
}
