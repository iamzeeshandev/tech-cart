import { DEMO_USER_COOKIE, DEMO_USER_HEADER } from "./demo-user";

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setDemoUser(userId: string) {
  document.cookie = `${DEMO_USER_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=31536000; samesite=lax`;
}

// Browser → /api proxy → NestJS. Throws with the API's message so the UI can show it.
export async function cartRequest(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
) {
  const userId = readCookie(DEMO_USER_COOKIE);
  if (!userId) throw new Error("Choose a demo user first (top right).");

  const res = await fetch(`/api/cart${path}`, {
    method,
    headers: { "content-type": "application/json", [DEMO_USER_HEADER]: userId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return res.json();
}
