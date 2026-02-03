import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, signSetPasswordToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/users — Admin only. List users in current organization.
 */
export async function GET(request: Request) {
  const session = await requireAdmin(request, "users:list");
  const users = await prisma.user.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ email: "asc" }],
  });
  return NextResponse.json(users);
}

/**
 * POST /api/users — Admin only. Invite (create) a user in the organization.
 * Body: { email, fullName?, role, password? }. If password omitted, user must use set-password link.
 */
export async function POST(request: Request) {
  const session = await requireAdmin(request, "users:invite");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() || null : null;
  const role = typeof b.role === "string" ? b.role : "";
  const password = typeof b.password === "string" ? b.password.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!["admin", "user"].includes(role)) {
    return NextResponse.json({ error: "Role must be admin or user." }, { status: 400 });
  }
  if (password.length > 0 && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters if provided." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: {
      organizationId_email: { organizationId: session.organizationId, email },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists in your organization." },
      { status: 409 }
    );
  }

  const passwordHash =
    password.length >= 6
      ? await hashPassword(password)
      : createHash("sha256").update(randomBytes(32)).digest("hex");

  const user = await prisma.user.create({
    data: {
      organizationId: session.organizationId,
      email,
      fullName,
      role,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const setPasswordToken = await signSetPasswordToken(user.id);
  const origin = new URL(request.url).origin;
  const setPasswordLink = `${origin}/set-password?token=${encodeURIComponent(setPasswordToken)}`;

  return NextResponse.json(
    { ...user, setPasswordLink },
    { status: 201 }
  );
}
