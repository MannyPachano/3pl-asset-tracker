import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = "3pl-asset-tracker";
const JWT_AUDIENCE = "3pl-asset-tracker";
const JWT_EXPIRY = "24h";
const SET_PASSWORD_EXPIRY = "7d";

export type AuthSession = {
  userId: number;
  organizationId: number;
  role: string;
};

function getSecret(): Uint8Array {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and at least 32 characters (e.g. in .env)"
    );
  }
  return new TextEncoder().encode(JWT_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function signToken(payload: AuthSession): Promise<string> {
  const secret = getSecret();
  return new SignJWT({
    userId: payload.userId,
    organizationId: payload.organizationId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .setSubject(String(payload.userId))
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<AuthSession | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const userId = Number(payload.userId);
    const organizationId = Number(payload.organizationId);
    const role = String(payload.role ?? "");
    if (!userId || !organizationId || !role) return null;
    return { userId, organizationId, role };
  } catch {
    return null;
  }
}

/** One-time/short-lived token for set-password flow (invited users). */
export async function signSetPasswordToken(userId: number): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ userId, purpose: "set_password" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(SET_PASSWORD_EXPIRY)
    .sign(secret);
}

/** Returns userId if token is valid and purpose is set_password. */
export async function verifySetPasswordToken(token: string): Promise<number | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (payload.purpose !== "set_password") return null;
    const userId = Number(payload.userId);
    return userId && Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}

/**
 * Reads Bearer token from Authorization header, verifies JWT, then loads user
 * from DB and checks is_active. Returns session or null (invalid/expired/inactive).
 */
export async function getSessionFromRequest(
  request: Request
): Promise<AuthSession | null> {
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true, organizationId: true, role: true },
  });
  if (!user || !user.isActive) return null;
  if (user.organizationId !== payload.organizationId || user.role !== payload.role) {
    return null;
  }

  return payload;
}

/**
 * Returns session for the request or throws NextResponse 401 with generic message.
 * Use in API route handlers that require authentication.
 */
export async function requireAuth(
  request: Request
): Promise<AuthSession> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }
  return session;
}

/**
 * Returns session for the request or throws. Use in Admin-only API routes.
 * 401 if unauthenticated; 403 if authenticated but not admin.
 */
export async function requireAdmin(
  request: Request,
  resource?: string
): Promise<AuthSession> {
  const session = await requireAuth(request);
  if (session.role !== "admin") {
    const { logger } = await import("@/lib/logger");
    logger.warn("User attempted to access Admin-only resource", {
      userId: session.userId,
      resource: resource ?? "settings",
    });
    throw NextResponse.json(
      { error: "You don't have access to this page." },
      { status: 403 }
    );
  }
  return session;
}
