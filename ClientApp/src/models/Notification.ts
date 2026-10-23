export interface PriceNotification {
  id: number;
  ozonProductId: number;
  productName: string;
  price: number;
  targetPrice: number;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationInbox {
  items: PriceNotification[];
  unreadCount: number;
}
