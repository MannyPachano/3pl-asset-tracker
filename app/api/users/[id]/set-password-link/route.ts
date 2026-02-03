import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { signSetPasswordToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/users/[id]/set-password-link — Admin only. Generate a new set-password link for the user.
 * Returns { setPasswordLink }. Use when the user lost the invite link or it expired.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin(request, "users:set-password-link");
  const { id: idParam } = await params;
  const userId = parseInt(idParam, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const token = await signSetPasswordToken(user.id);
  const origin = new URL(request.url).origin;
  const setPasswordLink = `${origin}/set-password?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ setPasswordLink });
}
