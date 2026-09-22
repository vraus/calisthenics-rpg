import "server-only";
import { headers } from "next/headers";

/**
 * Reads the user id that proxy.ts already validated (via a real
 * auth.getUser() network call) and forwarded as a request header - avoids
 * every page/Server Action re-doing that same network round trip. Safe:
 * proxy.ts sets this header itself from its own verified result on every
 * request, never from an incoming client value, so it can't be spoofed.
 * Actual data access is still entirely gated by Supabase RLS on each query
 * (via the session cookie), independent of this - this only answers "who's
 * asking", never "are they allowed to see this".
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const h = await headers();
  return h.get("x-user-id");
}

export async function getAuthenticatedUserEmail(): Promise<string | null> {
  const h = await headers();
  return h.get("x-user-email");
}
