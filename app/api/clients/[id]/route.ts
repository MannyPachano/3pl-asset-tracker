import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getClient(id: string, organizationId: number) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const c = await prisma.client.findUnique({
    where: { id: numId },
  });
  if (!c || c.organizationId !== organizationId) return null;
  return c;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const client = await getClient(id, session.organizationId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(client);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const client = await getClient(id, session.organizationId);
  if (!client) {
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

  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { name: name.trim() },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(request);
  const { id } = await params;
  const client = await getClient(id, session.organizationId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assetsCount = await prisma.asset.count({
    where: { clientId: client.id },
  });

  if (assetsCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: assets are assigned to this client",
        assetsCount,
      },
      { status: 409 }
    );
  }

  await prisma.client.delete({ where: { id: client.id } });
  return new NextResponse(null, { status: 204 });
}
