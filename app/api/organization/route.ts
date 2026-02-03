import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/organization — Admin only. Returns current user's organization.
 */
export async function GET(request: Request) {
  const session = await requireAdmin(request, "organization");
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }
  return NextResponse.json(org);
}

/**
 * PUT /api/organization — Admin only. Update organization (name).
 */
export async function PUT(request: Request) {
  const session = await requireAdmin(request, "organization");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof (body as Record<string, unknown>).name === "string"
    ? (body as Record<string, string>).name.trim()
    : "";
  if (!name) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: { name },
    select: { id: true, name: true },
  });
  return NextResponse.json(org);
}
