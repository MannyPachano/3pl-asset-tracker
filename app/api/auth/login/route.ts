import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

const GENERIC_ERROR_MESSAGE = "Invalid email or password.";

function identifierHash(email: string): string {
  if (!email) return "missing";
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 12);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      logger.warn("Login failed for identifier", { identifier: identifierHash(email) });
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        organizationId: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      logger.warn("Login failed for identifier", { identifier: identifierHash(email) });
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logger.warn("Login failed for identifier", { identifier: identifierHash(email) });
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 401 }
      );
    }

    logger.info("User logged in", { userId: user.id });
    const token = await signToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    return NextResponse.json({ token });
  } catch (err) {
    logger.error("Login request error", err);
    return NextResponse.json(
      { error: GENERIC_ERROR_MESSAGE },
      { status: 401 }
    );
  }
}
