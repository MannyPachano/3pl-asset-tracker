import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const list = await prisma.client.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
  });
  return NextResponse.json(
    list.map(({ _count, ...c }) => ({ ...c, assetsCount: _count.assets }))
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
  const name = typeof (body as Record<string, unknown>).name === "string"
    ? (body as Record<string, unknown>).name as string
    : "";

  if (!name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const client = await prisma.client.create({
    data: {
      organizationId: session.organizationId,
      name: name.trim(),
    },
  });
  return NextResponse.json(client, { status: 201 });
}
