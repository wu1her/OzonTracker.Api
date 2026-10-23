export const apiBase = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5080"
).replace(/\/$/, "");
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    path.startsWith("http") ? path : `${apiBase}${path}`,
    { ...init, credentials: "include" },
  );
  if (response.status === 401)
    window.dispatchEvent(new Event("session-expired"));
  return response;
}
export async function checked(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    } | null;
    throw new Error(
      body?.message ??
        (body?.errors
          ? Object.values(body.errors).flat().join(" ")
          : body?.title) ??
        `Ошибка HTTP ${response.status}`,
    );
  }
  return response;
}
export async function json<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  return (
    await checked(path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    })
  ).json() as Promise<T>;
}
