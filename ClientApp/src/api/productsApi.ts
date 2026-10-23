import type { Product } from "../models/Product";

const apiBaseUrl =
  import.meta.env.VITE_API_URL ?? "http://localhost:5080";

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: string;
      title?: string;
    };

    return data.message ?? data.title ?? `Ошибка HTTP ${response.status}`;
  } catch {
    return `Ошибка HTTP ${response.status}`;
  }
}

export async function getProducts(
  signal?: AbortSignal,
): Promise<Product[]> {
  const response = await fetch(`${apiBaseUrl}/api/products`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as Product[];
}

export async function addProduct(value: string): Promise<Product> {
  const response = await fetch(`${apiBaseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as Product;
}

export async function deleteProduct(
  ozonProductId: number,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/api/products/${ozonProductId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
}
