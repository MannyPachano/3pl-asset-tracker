import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/users/[id] — Admin only. Update user (e.g. deactivate).
 * Body: { isActive?: boolean }
 * Guard: cannot deactivate self (return 400).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin(request, "users:deactivate");
  const { id: idParam } = await params;
  const targetId = parseInt(idParam, 10);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: targetId, organizationId: session.organizationId },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const isActive = (body as Record<string, unknown>).isActive;
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
  }

  if (targetId === session.userId && isActive === false) {
    logger.info("User attempted to deactivate self; blocked.", { userId: session.userId });
    return NextResponse.json(
      { error: "You cannot deactivate your own account." },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json(updated);
}
