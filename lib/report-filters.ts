import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

export type ReportWhere = {
  organizationId: number;
  updatedAt?: { gte?: Date; lte?: Date };
  assetTypeId?: number;
  status?: string;
  clientId?: number | null | { not: null };
  warehouseId?: number | null;
  zoneId?: number | null;
};

/**
 * Build and validate report filter where clause from request search params.
 * Returns either an error response or the where object for use with prisma.asset.findMany.
 */
export async function buildReportWhere(
  request: Request,
  prisma: PrismaClient,
  orgId: number
): Promise<{ error: NextResponse } | { where: ReportWhere }> {
  const { searchParams } = new URL(request.url);

  const fromDateRaw = searchParams.get("fromDate")?.trim();
  const toDateRaw = searchParams.get("toDate")?.trim();
  const assetTypeIdParam = searchParams.get("assetTypeId");
  const status = searchParams.get("status");
  const clientIdParam = searchParams.get("clientId");
  const warehouseIdParam = searchParams.get("warehouseId");
  const zoneIdParam = searchParams.get("zoneId");

  if (assetTypeIdParam) {
    const id = parseInt(assetTypeIdParam, 10);
    if (!Number.isInteger(id)) {
      return { error: NextResponse.json({ error: "Invalid filter: asset type." }, { status: 400 }) };
    }
    const exists = await prisma.assetType.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return { error: NextResponse.json({ error: "Invalid filter: asset type." }, { status: 400 }) };
    }
  }
  if (clientIdParam && clientIdParam !== "company" && clientIdParam !== "client_owned") {
    const id = parseInt(clientIdParam, 10);
    if (!Number.isInteger(id)) {
      return { error: NextResponse.json({ error: "Invalid filter: owner." }, { status: 400 }) };
    }
    const exists = await prisma.client.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return { error: NextResponse.json({ error: "Invalid filter: owner." }, { status: 400 }) };
    }
  }
  if (warehouseIdParam) {
    const id = parseInt(warehouseIdParam, 10);
    if (!Number.isInteger(id)) {
      return { error: NextResponse.json({ error: "Invalid filter: warehouse." }, { status: 400 }) };
    }
    const exists = await prisma.warehouse.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return { error: NextResponse.json({ error: "Invalid filter: warehouse." }, { status: 400 }) };
    }
  }
  if (zoneIdParam) {
    const id = parseInt(zoneIdParam, 10);
    if (!Number.isInteger(id)) {
      return { error: NextResponse.json({ error: "Invalid filter: zone." }, { status: 400 }) };
    }
    const zone = await prisma.zone.findFirst({
      where: { id },
      include: { warehouse: true },
    });
    if (!zone || zone.warehouse.organizationId !== orgId) {
      return { error: NextResponse.json({ error: "Invalid filter: zone." }, { status: 400 }) };
    }
  }

  const where: ReportWhere = { organizationId: orgId };

  if (fromDateRaw || toDateRaw) {
    let from: Date | undefined;
    let to: Date | undefined;
    if (fromDateRaw) {
      const d = new Date(fromDateRaw + "T00:00:00.000Z");
      if (Number.isNaN(d.getTime())) {
        return { error: NextResponse.json({ error: "Invalid filter: from date." }, { status: 400 }) };
      }
      from = d;
    }
    if (toDateRaw) {
      const d = new Date(toDateRaw + "T23:59:59.999Z");
      if (Number.isNaN(d.getTime())) {
        return { error: NextResponse.json({ error: "Invalid filter: to date." }, { status: 400 }) };
      }
      to = d;
    }
    if (from && to && from > to) {
      return { error: NextResponse.json({ error: "Invalid filter: from date must be before to date." }, { status: 400 }) };
    }
    where.updatedAt = {};
    if (from) where.updatedAt.gte = from;
    if (to) where.updatedAt.lte = to;
  }

  if (assetTypeIdParam) {
    const n = parseInt(assetTypeIdParam, 10);
    if (Number.isInteger(n)) where.assetTypeId = n;
  }
  if (status && ["in_use", "idle", "damaged", "lost"].includes(status)) {
    where.status = status;
  }
  if (clientIdParam !== undefined && clientIdParam !== null) {
    if (clientIdParam === "" || clientIdParam === "company") {
      where.clientId = null;
    } else if (clientIdParam === "client_owned") {
      where.clientId = { not: null };
    } else {
      const n = parseInt(clientIdParam, 10);
      if (Number.isInteger(n)) where.clientId = n;
    }
  }
  if (warehouseIdParam) {
    const n = parseInt(warehouseIdParam, 10);
    if (Number.isInteger(n)) where.warehouseId = n;
  }
  if (zoneIdParam) {
    const n = parseInt(zoneIdParam, 10);
    if (Number.isInteger(n)) where.zoneId = n;
  }

  return { where };
}
