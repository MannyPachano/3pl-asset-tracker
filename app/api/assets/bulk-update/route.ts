import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assetSnapshot } from "@/lib/asset-validation";

const STATUSES = ["in_use", "idle", "damaged", "lost"] as const;
const MAX_BULK = 500;

type BulkUpdateBody = {
  assetIds: number[];
  warehouseId?: number | null;
  zoneId?: number | null;
  status?: string;
  clientId?: number | null;
};

function parseBody(body: unknown): BulkUpdateBody | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const assetIds = b.assetIds;
  if (!Array.isArray(assetIds)) return null;
  const ids = assetIds.filter((id) => Number.isInteger(Number(id))).map(Number);
  if (ids.length === 0 || ids.length > MAX_BULK) return null;

  const out: BulkUpdateBody = { assetIds: ids };

  if (b.warehouseId !== undefined) {
    if (b.warehouseId === null) out.warehouseId = null;
    else {
      const n = Number(b.warehouseId);
      if (Number.isInteger(n)) out.warehouseId = n;
    }
  }
  if (b.zoneId !== undefined) {
    if (b.zoneId === null) out.zoneId = null;
    else {
      const n = Number(b.zoneId);
      if (Number.isInteger(n)) out.zoneId = n;
    }
  }
  if (typeof b.status === "string" && b.status.trim()) out.status = b.status.trim();
  if (b.clientId !== undefined) {
    if (b.clientId === null || b.clientId === "company") out.clientId = null;
    else {
      const n = Number(b.clientId);
      if (Number.isInteger(n)) out.clientId = n;
    }
  }

  return out;
}

export async function POST(request: Request) {
  const session = await requireAuth(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseBody(body);
  if (!input) {
    return NextResponse.json(
      { error: "assetIds (array of 1–500 asset IDs) required; optional: warehouseId, zoneId, status, clientId." },
      { status: 400 }
    );
  }

  const orgId = session.organizationId;

  const assets = await prisma.asset.findMany({
    where: { id: { in: input.assetIds }, organizationId: orgId },
  });
  if (assets.length !== input.assetIds.length) {
    return NextResponse.json(
      { error: "One or more asset IDs not found or not in your organization." },
      { status: 400 }
    );
  }

  if (input.zoneId != null && input.warehouseId == null) {
    return NextResponse.json(
      { error: "Warehouse is required when setting zone." },
      { status: 400 }
    );
  }

  if (input.warehouseId != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId: orgId },
    });
    if (!wh) {
      return NextResponse.json({ error: "Invalid warehouse." }, { status: 400 });
    }
  }

  if (input.zoneId != null && input.warehouseId != null) {
    const zone = await prisma.zone.findFirst({
      where: { id: input.zoneId, warehouseId: input.warehouseId },
      include: { warehouse: true },
    });
    if (!zone || zone.warehouse.organizationId !== orgId) {
      return NextResponse.json({ error: "Invalid zone for the selected warehouse." }, { status: 400 });
    }
  }

  if (input.status != null && !STATUSES.includes(input.status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  if (input.clientId != null) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, organizationId: orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Invalid client." }, { status: 400 });
    }
  }

  const updateData: Prisma.AssetUpdateInput = {};
  if (input.warehouseId !== undefined) {
    updateData.warehouse = input.warehouseId != null ? { connect: { id: input.warehouseId } } : { disconnect: true };
  }
  if (input.zoneId !== undefined) {
    updateData.zone = input.zoneId != null ? { connect: { id: input.zoneId } } : { disconnect: true };
  } else if (input.warehouseId !== undefined) {
    updateData.zone = { disconnect: true };
  }
  if (input.status !== undefined) updateData.status = input.status;
  if (input.clientId !== undefined) {
    updateData.client = input.clientId != null ? { connect: { id: input.clientId } } : { disconnect: true };
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Provide at least one field to update: warehouseId, zoneId, status, clientId." }, { status: 400 });
  }

  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const asset of assets) {
      const a = await tx.asset.update({
        where: { id: asset.id },
        data: updateData,
      });
      await tx.assetHistory.create({
        data: {
          assetId: a.id,
          userId: session.userId,
          changedAt: a.updatedAt,
          snapshot: assetSnapshot({
            status: a.status,
            quantity: (a as { quantity?: number }).quantity ?? 1,
            warehouseId: a.warehouseId,
            zoneId: a.zoneId,
            clientId: a.clientId,
            notes: a.notes,
          }) as Prisma.InputJsonValue,
        },
      });
      updated++;
    }
  });

  return NextResponse.json({ updated });
}
