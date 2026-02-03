import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getAssetType(id: string, organizationId: number) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const a = await prisma.assetType.findUnique({
    where: { id: numId },
  });
  if (!a || a.organizationId !== organizationId) return null;
  return a;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const assetType = await getAssetType(id, session.organizationId);
  if (!assetType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(assetType);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const assetType = await getAssetType(id, session.organizationId);
  if (!assetType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name : "";
  const code = b.code === undefined || b.code === null ? undefined : String(b.code).trim() || undefined;

  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.assetType.update({
    where: { id: assetType.id },
    data: { name: name.trim(), code: code },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const assetType = await getAssetType(id, session.organizationId);
  if (!assetType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assetsCount = await prisma.asset.count({
    where: { assetTypeId: assetType.id },
  });

  if (assetsCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: assets use this type",
        assetsCount,
      },
      { status: 409 }
    );
  }

  await prisma.assetType.delete({ where: { id: assetType.id } });
  return new NextResponse(null, { status: 204 });
}
