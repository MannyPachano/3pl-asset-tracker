import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getWarehouse(id: string, organizationId: number) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const w = await prisma.warehouse.findUnique({
    where: { id: numId },
  });
  if (!w || w.organizationId !== organizationId) return null;
  return w;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const warehouse = await getWarehouse(id, session.organizationId);
  if (!warehouse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(warehouse);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const warehouse = await getWarehouse(id, session.organizationId);
  if (!warehouse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof (body as Record<string, unknown>).name === "string"
    ? (body as Record<string, unknown>).name as string
    : "";
  const code = (body as Record<string, unknown>).code;
  const codeStr = code === undefined || code === null ? undefined : String(code).trim() || undefined;

  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: { name: name.trim(), code: codeStr },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const warehouse = await getWarehouse(id, session.organizationId);
  if (!warehouse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [zonesCount, assetsCount] = await Promise.all([
    prisma.zone.count({ where: { warehouseId: warehouse.id } }),
    prisma.asset.count({ where: { warehouseId: warehouse.id } }),
  ]);

  if (zonesCount > 0 || assetsCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: this warehouse has zones or assets",
        zonesCount,
        assetsCount,
      },
      { status: 409 }
    );
  }

  await prisma.warehouse.delete({ where: { id: warehouse.id } });
  return new NextResponse(null, { status: 204 });
}
