import { cookies } from "next/headers";
import { DEMO_USER_COOKIE, DEMO_USER_HEADER } from "./demo-user";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export type DemoUser = { id: string; name: string; email: string };

export type CartItem = {
  id: string;
  quantity: number;
  lineTotal: number;
  product: Pick<Product, "id" | "slug" | "name" | "imageUrl" | "priceAmount" | "currency" | "inventory">;
};

export type Cart = { items: CartItem[]; subtotal: number; currency: string };

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

export async function getDemoUsers(): Promise<DemoUser[]> {
  const res = await fetch(`${API_URL}/api/demo-users`);
  if (!res.ok) throw new Error(`GET /api/demo-users failed: ${res.status}`);
  return res.json();
}

export async function getCurrentUserId(): Promise<string | undefined> {
  return (await cookies()).get(DEMO_USER_COOKIE)?.value;
}

// null when the cookie's user no longer exists (e.g. after a DB reset): the page asks to pick a user.
export async function getCart(userId: string): Promise<Cart | null> {
  const res = await fetch(`${API_URL}/api/cart`, { headers: { [DEMO_USER_HEADER]: userId } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /api/cart failed: ${res.status}`);
  return res.json();
}
