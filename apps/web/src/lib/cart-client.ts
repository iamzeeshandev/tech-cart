import { DEMO_USER_COOKIE, DEMO_USER_HEADER } from "./demo-user";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setDemoUser(userId: string) {
  document.cookie = `${DEMO_USER_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=31536000; samesite=lax`;
}

// Browser → /api proxy → NestJS. Throws with the API's message so the UI can show it.
async function apiRequest(
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
) {
  const userId = readCookie(DEMO_USER_COOKIE);
  if (!userId) throw new Error("Choose a demo user first (top right).");

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...init.headers, [DEMO_USER_HEADER]: userId },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new ApiError(message ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export function cartRequest(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  return apiRequest(`/cart${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function startCheckout(idempotencyKey: string): Promise<{ checkoutUrl: string | null }> {
  return apiRequest("/checkout", { method: "POST", headers: { "Idempotency-Key": idempotencyKey } });
}
