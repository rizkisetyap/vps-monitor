import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "vpsmon_session";
const alg = "HS256";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a long random value in .env (openssl rand -base64 48)."
    );
  }
  return new TextEncoder().encode(secret);
}

function getTtlSeconds() {
  const raw = process.env.SESSION_TTL_SECONDS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8 * 60 * 60;
}

export async function createSessionToken(username: string): Promise<string> {
  const ttl = getTtlSeconds();
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_TTL_SECONDS = getTtlSeconds();
