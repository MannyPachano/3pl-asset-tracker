import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const HISTORY_LIMIT = 10;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const asset = await prisma.asset.findUnique({
    where: { id: numId },
    select: { id: true, organizationId: true },
  });
  if (!asset || asset.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await prisma.assetHistory.findMany({
    where: { assetId: asset.id },
    orderBy: { changedAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      user: { select: { fullName: true, email: true } },
    },
  });

  const items = history.map((h) => ({
    id: h.id,
    changedAt: h.changedAt,
    user: h.user.fullName?.trim() || h.user.email,
    snapshot: h.snapshot,
  }));

  return NextResponse.json({ items });
}
