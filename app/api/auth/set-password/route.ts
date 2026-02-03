import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySetPasswordToken, hashPassword } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 6;

/**
 * POST /api/auth/set-password — Unauthenticated. For invited users to set their password.
 * Body: { token, password }. Token is JWT from set-password link (userId, purpose: set_password, exp 7d).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) {
      return NextResponse.json(
        { error: "Invalid or expired link. Request a new one from your admin." },
        { status: 400 }
      );
    }

    const userId = await verifySetPasswordToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired link. Request a new one from your admin." },
        { status: 400 }
      );
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired link. Request a new one from your admin." },
        { status: 400 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Invalid or expired link. Request a new one from your admin." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const { logger } = await import("@/lib/logger");
    logger.error("Set-password request error", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
