const API_URL = process.env.API_URL ?? "http://localhost:4000";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceAmount: number;
  currency: string;
  category: { slug: string; name: string };
  inventory: { quantityAvailable: number } | null;
};

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products`);
  if (!res.ok) throw new Error(`GET /api/products failed: ${res.status}`);
  return res.json();
}

export async function getProduct(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_URL}/api/products/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/products/${slug} failed: ${res.status}`);
  return res.json();
}
