import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const list = await prisma.assetType.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      serialized: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
  });
  return NextResponse.json(
    list.map(({ _count, ...a }) => ({ ...a, assetsCount: _count.assets }))
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
  const name = typeof b.name === "string" ? b.name : "";
  const code = b.code === undefined || b.code === null ? undefined : String(b.code).trim() || undefined;
  const serialized = b.serialized === undefined || b.serialized === null ? true : Boolean(b.serialized);

  if (!name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const assetType = await prisma.assetType.create({
    data: {
      organizationId: session.organizationId,
      name: name.trim(),
      code: code,
      serialized,
    },
  });
  return NextResponse.json(assetType, { status: 201 });
}
