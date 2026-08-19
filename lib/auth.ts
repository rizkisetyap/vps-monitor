import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

/** Use inside Route Handlers (Node runtime) to check the caller is logged in. */
export async function requireSession(): Promise<{ sub: string } | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
