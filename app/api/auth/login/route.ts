import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session";

export const runtime = "nodejs";

// Very small in-memory rate limiter. Good enough for a single-instance
// internal tool; resets on deploy/restart.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expectedUsername = process.env.ADMIN_USERNAME;
  const passwordHashB64 = process.env.ADMIN_PASSWORD_HASH_B64;

  if (!expectedUsername || !passwordHashB64) {
    return NextResponse.json(
      { error: "Server is not configured (ADMIN_USERNAME / ADMIN_PASSWORD_HASH_B64 missing)" },
      { status: 500 }
    );
  }

  // The hash is stored base64-encoded in .env because bcrypt hashes contain
  // literal "$" characters (e.g. "$2a$10$..."), and Next.js performs
  // shell-style $VAR expansion on .env files (via dotenv-expand). Storing it
  // raw silently truncates the hash at the first unmatched $VAR reference.
  const passwordHash = Buffer.from(passwordHashB64, "base64").toString("utf-8");

  const usernameOk = username === expectedUsername;
  const passwordOk = await bcrypt.compare(password, passwordHash);

  if (!usernameOk || !passwordOk) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
      const isSecure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS
      });
  return res;
}
