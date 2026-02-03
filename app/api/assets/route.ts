import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  validateAssetCreate,
  assetSnapshot,
  type AssetCreateInput,
} from "@/lib/asset-validation";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search")?.trim() ?? "";
  const assetTypeId = searchParams.get("assetTypeId");
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const warehouseId = searchParams.get("warehouseId");
  const zoneId = searchParams.get("zoneId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const where: {
    organizationId: number;
    labelId?: { contains: string; mode: "insensitive" };
    assetTypeId?: number;
    status?: string;
    clientId?: number | null;
    warehouseId?: number | null;
    zoneId?: number | null;
  } = {
    organizationId: session.organizationId,
  };

  if (search) {
    where.labelId = { contains: search, mode: "insensitive" };
  }
  if (assetTypeId) {
    const n = parseInt(assetTypeId, 10);
    if (Number.isInteger(n)) where.assetTypeId = n;
  }
  if (status) {
    if (["in_use", "idle", "damaged", "lost"].includes(status)) {
      where.status = status;
    }
  }
  if (clientId !== undefined && clientId !== null) {
    if (clientId === "" || clientId === "company") {
      where.clientId = null;
    } else if (clientId === "client" || clientId === "client_owned") {
      where.clientId = { not: null };
    } else {
      const n = parseInt(clientId, 10);
      if (Number.isInteger(n)) where.clientId = n;
    }
  }
  if (warehouseId) {
    const n = parseInt(warehouseId, 10);
    if (Number.isInteger(n)) where.warehouseId = n;
  }
  if (zoneId) {
    const n = parseInt(zoneId, 10);
    if (Number.isInteger(n)) where.zoneId = n;
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { labelId: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        assetType: { select: { id: true, name: true, code: true } },
        client: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
  });
}

function parseBodyToCreateInput(body: unknown): AssetCreateInput | null {
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

export async function POST(request: Request) {
  const session = await requireAuth(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseBodyToCreateInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Label ID and asset type are required." },
      { status: 400 }
    );
  }

  const validation = await validateAssetCreate(session.organizationId, input);
  if (validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        organizationId: session.organizationId,
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
        assetId: created.id,
        userId: session.userId,
        changedAt: created.createdAt,
        snapshot: assetSnapshot({
          status: created.status,
          warehouseId: created.warehouseId,
          zoneId: created.zoneId,
          clientId: created.clientId,
        }) as Prisma.InputJsonValue,
      },
    });
    return created;
  });

  return NextResponse.json(asset, { status: 201 });
}
