import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const list = await prisma.zone.findMany({
    where: { warehouse: { organizationId: session.organizationId } },
    orderBy: [{ warehouse: { name: "asc" } }, { name: "asc" }],
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      _count: { select: { assets: true } },
    },
  });
  return NextResponse.json(
    list.map(({ warehouse, _count, ...z }) => ({
      ...z,
      warehouse,
      assetsCount: _count.assets,
    }))
  );
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
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
    return NextResponse.json(
      { error: "Warehouse is required" },
      { status: 400 }
    );
  }
  if (!name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
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

  const zone = await prisma.zone.create({
    data: {
      warehouseId: warehouse.id,
      name: name.trim(),
      code: code,
    },
  });
  return NextResponse.json(zone, { status: 201 });
}
