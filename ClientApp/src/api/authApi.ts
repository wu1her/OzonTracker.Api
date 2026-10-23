import { apiBase } from "./client";
export interface Account {
  id: number;
  email: string;
}
export async function authRequest(
  path: string,
  body?: unknown,
): Promise<Account> {
  const response = await fetch(`${apiBase}/api/auth/${path}`, {
    credentials: "include",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.message ?? "Не удалось войти. Проверьте данные и доступность базы.",
    );
  }
  return response.json() as Promise<Account>;
}
export async function logout() {
  const response = await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok && response.status !== 401)
    throw new Error("Не удалось выйти. Повторите попытку.");
}
