import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const orgId = session.organizationId;

  const [total, byStatusRows, companyOwned, clientOwned] = await Promise.all([
    prisma.asset.count({ where: { organizationId: orgId } }),
    prisma.asset.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
    prisma.asset.count({
      where: { organizationId: orgId, clientId: null },
    }),
    prisma.asset.count({
      where: { organizationId: orgId, clientId: { not: null } },
    }),
  ]);

  const byStatus: Record<string, number> = {
    in_use: 0,
    idle: 0,
    damaged: 0,
    lost: 0,
  };
  byStatusRows.forEach((row) => {
    byStatus[row.status] = row._count.id;
  });

  return NextResponse.json({
    total,
    byStatus,
    byOwner: {
      companyOwned,
      clientOwned,
    },
  });
}
