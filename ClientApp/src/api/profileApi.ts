import type { ChatMessage, DemoProfile, Subscription } from "../models/Profile";

const apiBase = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5080"
).replace(/\/$/, "");
export const avatarAddress = (url: string) => `${apiBase}${url}`;

async function checked(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    } | null;
    const errors = body?.errors
      ? Object.values(body.errors).flat().join(" ")
      : null;
    throw new Error(
      body?.message ??
        errors ??
        body?.title ??
        `Ошибка HTTP ${response.status}`,
    );
  }
  return response;
}

async function json<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await checked(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  return response.json() as Promise<T>;
}

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
