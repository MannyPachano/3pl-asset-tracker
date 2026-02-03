import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getZone(id: string, organizationId: number) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const z = await prisma.zone.findUnique({
    where: { id: numId },
    include: { warehouse: true },
  });
  if (!z || z.warehouse.organizationId !== organizationId) return null;
  return z;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const zone = await getZone(id, session.organizationId);
  if (!zone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { warehouse, ...z } = zone;
  return NextResponse.json({ ...z, warehouse: { id: warehouse.id, name: warehouse.name, code: warehouse.code } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const zone = await getZone(id, session.organizationId);
  if (!zone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const warehouseId = b.warehouseId !== undefined ? Number(b.warehouseId) : NaN;
  const name = typeof b.name === "string" ? b.name : "";
  const code = b.code === undefined || b.code === null ? undefined : String(b.code).trim() || undefined;

  if (!Number.isInteger(warehouseId) || warehouseId < 1) {
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  }
  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId: session.organizationId },
  });
  if (!warehouse) {
    return NextResponse.json(
      { error: "Warehouse not found" },
      { status: 400 }
    );
  }

  const updated = await prisma.zone.update({
    where: { id: zone.id },
    data: { warehouseId: warehouse.id, name: name.trim(), code: code },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const zone = await getZone(id, session.organizationId);
  if (!zone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assetsCount = await prisma.asset.count({
    where: { zoneId: zone.id },
  });

  if (assetsCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: assets use this zone",
        assetsCount,
      },
      { status: 409 }
    );
  }

  await prisma.zone.delete({ where: { id: zone.id } });
  return new NextResponse(null, { status: 204 });
}
