import type { ChatMessage, DemoProfile, Subscription } from "../models/Profile";

import { apiBase, checked, json } from "./client";
export const avatarAddress = (url: string) => `${apiBase}${url}`;

export const getProfile = () => json<DemoProfile>("/api/profile");
export const saveProfile = (
  profile: Pick<DemoProfile, "displayName" | "fullName" | "phone" | "about">,
) => json<DemoProfile>("/api/profile", "PUT", profile);
export const linkEmail = (email: string) =>
  json<DemoProfile>("/api/profile/email", "PUT", { email });
export const unlinkEmail = () =>
  json<DemoProfile>("/api/profile/email", "DELETE");
export const changeSubscription = (subscription: Subscription) =>
  json<DemoProfile>("/api/profile/subscription", "PUT", { subscription });
export const removeAvatar = () =>
  json<DemoProfile>("/api/profile/avatar", "DELETE");
export async function uploadAvatar(file: Blob): Promise<DemoProfile> {
  const form = new FormData();
  form.append("file", file, "avatar.png");
  return (
    await checked("/api/profile/avatar", { method: "POST", body: form })
  ).json() as Promise<DemoProfile>;
}
export const getChat = () => json<ChatMessage[]>("/api/chat");
export const sendChat = (text: string) =>
  json<ChatMessage[]>("/api/chat", "POST", { text });
export const clearChat = () => checked("/api/chat", { method: "DELETE" });
export async function exportProducts(): Promise<void> {
  const response = await checked("/api/products/export");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ozon-products.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
