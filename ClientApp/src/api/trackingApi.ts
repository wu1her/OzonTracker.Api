import { checked, json } from "./client";
import type { Product } from "../models/Product";
import type { NotificationInbox } from "../models/Notification";
import type { DemoProfile } from "../models/Profile";
export const setPreferences = (
  product: Product,
  isFavorite: boolean,
  targetPrice: number | null,
) =>
  json<Product>(`/api/products/${product.ozonProductId}/preferences`, "PUT", {
    isFavorite,
    targetPrice,
  });
export const getNotifications = () =>
  json<NotificationInbox>("/api/notifications");
export const readNotification = (id: number) =>
  checked(`/api/notifications/${id}/read`, { method: "POST" });
export const readAllNotifications = () =>
  checked("/api/notifications/read-all", { method: "POST" });
export const runScenario = (scenario: string, ozonProductId?: number) =>
  json<{ updatedProducts: number }>("/api/demo/scenario", "POST", {
    scenario,
    ozonProductId,
  });
export const saveRefresh = (
  refreshMinutes: number,
  notificationsEnabled: boolean,
  compactTable: boolean,
) =>
  json<DemoProfile>("/api/profile/settings", "PUT", {
    refreshMinutes,
    notificationsEnabled,
    compactTable,
  });
