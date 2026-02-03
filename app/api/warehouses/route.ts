import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const list = await prisma.warehouse.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { zones: true, assets: true } },
    },
  });
  return NextResponse.json(
    list.map(({ _count, ...w }) => ({ ...w, zonesCount: _count.zones, assetsCount: _count.assets }))
  );
}

export async function POST(request: Request) {
  const session = await requireAuth(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const name = typeof (body as Record<string, unknown>).name === "string"
    ? (body as Record<string, unknown>).name as string
    : "";
  const code = (body as Record<string, unknown>).code;
  const codeStr = code === undefined || code === null ? undefined : String(code).trim() || undefined;

  if (!name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId: session.organizationId,
      name: name.trim(),
      code: codeStr,
    },
  });
  return NextResponse.json(warehouse, { status: 201 });
}
