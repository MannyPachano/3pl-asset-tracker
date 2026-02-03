import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  validateAssetCreate,
  assetSnapshot,
  type AssetCreateInput,
} from "@/lib/asset-validation";

async function getAsset(
  id: string,
  organizationId: number
) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const asset = await prisma.asset.findUnique({
    where: { id: numId },
    include: {
      assetType: { select: { id: true, name: true, code: true } },
      client: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      zone: { select: { id: true, name: true, code: true } },
    },
  });
  if (!asset || asset.organizationId !== organizationId) return null;
  return asset;
}

function parseBodyToUpdateInput(body: unknown): AssetCreateInput | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const labelId = typeof b.label_id === "string" ? b.label_id : typeof b.labelId === "string" ? b.labelId : "";
  const assetTypeId = b.asset_type_id != null ? Number(b.asset_type_id) : b.assetTypeId != null ? Number(b.assetTypeId) : NaN;
  const clientId = b.client_id === null || b.client_id === undefined
    ? (b.clientId === null || b.clientId === undefined ? null : Number(b.clientId))
    : Number(b.client_id);
  const warehouseId = b.warehouse_id === null || b.warehouse_id === undefined
    ? (b.warehouseId === null || b.warehouseId === undefined ? null : Number(b.warehouseId))
    : Number(b.warehouse_id);
  const zoneId = b.zone_id === null || b.zone_id === undefined
    ? (b.zoneId === null || b.zoneId === undefined ? null : Number(b.zoneId))
    : Number(b.zone_id);
  const status = typeof b.status === "string" ? b.status : "";
  const notes = b.notes === null || b.notes === undefined
    ? (b.notes === null || b.notes === undefined ? null : String(b.notes))
    : String(b.notes);

  if (!labelId || !Number.isInteger(assetTypeId)) return null;
  const clientIdResolved = clientId === undefined || Number.isNaN(clientId) ? null : clientId;
  const warehouseIdResolved = warehouseId === undefined || Number.isNaN(warehouseId) ? null : warehouseId;
  const zoneIdResolved = zoneId === undefined || Number.isNaN(zoneId) ? null : zoneId;

  return {
    labelId,
    assetTypeId,
    clientId: clientIdResolved,
    warehouseId: warehouseIdResolved,
    zoneId: zoneIdResolved,
    status,
    notes: notes === "" ? null : notes,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const asset = await getAsset(id, session.organizationId);
  if (!asset) {
    logger.debug("User requested asset not in org", { userId: session.userId, assetId: id });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(asset);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: Number(id) },
  });
  if (!asset || asset.organizationId !== session.organizationId) {
    logger.debug("User requested asset not in org", { userId: session.userId, assetId: id });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseBodyToUpdateInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Label ID and asset type are required." },
      { status: 400 }
    );
  }

  const validation = await validateAssetCreate(
    session.organizationId,
    input,
    asset.id
  );
  if (validation) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.asset.update({
      where: { id: asset.id },
      data: {
        assetTypeId: input.assetTypeId,
        clientId: input.clientId,
        warehouseId: input.warehouseId,
        zoneId: input.zoneId,
        labelId: input.labelId.trim(),
        status: input.status,
        notes: input.notes?.trim() || null,
      },
    });
    await tx.assetHistory.create({
      data: {
        assetId: a.id,
        userId: session.userId,
        changedAt: a.updatedAt,
        snapshot: assetSnapshot({
          status: a.status,
          warehouseId: a.warehouseId,
          zoneId: a.zoneId,
          clientId: a.clientId,
        }) as Prisma.InputJsonValue,
      },
    });
    return a;
  });

  const withRelations = await prisma.asset.findUnique({
    where: { id: updated.id },
    include: {
      assetType: { select: { id: true, name: true, code: true } },
      client: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      zone: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json(withRelations ?? updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: Number(id) },
  });
  if (!asset || asset.organizationId !== session.organizationId) {
    logger.debug("User requested asset not in org", { userId: session.userId, assetId: id });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const historyCount = await prisma.assetHistory.count({
    where: { assetId: asset.id },
  });

  if (historyCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this asset has change history." },
      { status: 409 }
    );
  }

  await prisma.asset.delete({ where: { id: asset.id } });
  return new NextResponse(null, { status: 204 });
}
