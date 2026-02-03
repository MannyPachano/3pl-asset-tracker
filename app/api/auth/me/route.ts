import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Returns current user and org for the session (e.g. header display).
 * Requires Authorization: Bearer <token>.
 */
export async function GET(request: Request) {
  const session = await requireAuth(request);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, email: true },
  });
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true },
  });
  return Response.json({
    userId: session.userId,
    organizationId: session.organizationId,
    role: session.role,
    organizationName: org?.name ?? "",
    fullName: user?.fullName ?? null,
    email: user?.email ?? "",
  });
}
