import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const EXPORT_MAX_ROWS = 50_000;

/** CSV spec: quote field if it contains comma, newline, or double-quote; escape " as "". */
function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Format updated_at as ISO 8601 UTC. */
function formatLastUpdated(date: Date): string {
  return date.toISOString();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const { searchParams } = new URL(request.url);

  const fromDateRaw = searchParams.get("fromDate")?.trim();
  const toDateRaw = searchParams.get("toDate")?.trim();
  const assetTypeIdParam = searchParams.get("assetTypeId");
  const status = searchParams.get("status");
  const clientIdParam = searchParams.get("clientId");
  const warehouseIdParam = searchParams.get("warehouseId");
  const zoneIdParam = searchParams.get("zoneId");

  const orgId = session.organizationId;

  // Validate filter IDs belong to current org
  if (assetTypeIdParam) {
    const id = parseInt(assetTypeIdParam, 10);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid filter: asset type." }, { status: 400 });
    }
    const exists = await prisma.assetType.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return NextResponse.json({ error: "Invalid filter: asset type." }, { status: 400 });
    }
  }
  if (clientIdParam && clientIdParam !== "company" && clientIdParam !== "client_owned") {
    const id = parseInt(clientIdParam, 10);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid filter: owner." }, { status: 400 });
    }
    const exists = await prisma.client.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return NextResponse.json({ error: "Invalid filter: owner." }, { status: 400 });
    }
  }
  if (warehouseIdParam) {
    const id = parseInt(warehouseIdParam, 10);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid filter: warehouse." }, { status: 400 });
    }
    const exists = await prisma.warehouse.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!exists) {
      return NextResponse.json({ error: "Invalid filter: warehouse." }, { status: 400 });
    }
  }
  if (zoneIdParam) {
    const id = parseInt(zoneIdParam, 10);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid filter: zone." }, { status: 400 });
    }
    const zone = await prisma.zone.findFirst({
      where: { id },
      include: { warehouse: true },
    });
    if (!zone || zone.warehouse.organizationId !== orgId) {
      return NextResponse.json({ error: "Invalid filter: zone." }, { status: 400 });
    }
  }

  type Where = {
    organizationId: number;
    updatedAt?: { gte?: Date; lte?: Date };
    assetTypeId?: number;
    status?: string;
    clientId?: number | null | { not: null };
    warehouseId?: number | null;
    zoneId?: number | null;
  };

  const where: Where = { organizationId: orgId };

  if (fromDateRaw || toDateRaw) {
    let from: Date | undefined;
    let to: Date | undefined;
    if (fromDateRaw) {
      const d = new Date(fromDateRaw + "T00:00:00.000Z");
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid filter: from date." }, { status: 400 });
      }
      from = d;
    }
    if (toDateRaw) {
      const d = new Date(toDateRaw + "T23:59:59.999Z");
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid filter: to date." }, { status: 400 });
      }
      to = d;
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: "Invalid filter: from date must be before to date." }, { status: 400 });
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

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { labelId: "asc" }],
    take: EXPORT_MAX_ROWS + 1,
    include: {
      assetType: { select: { name: true, code: true } },
      client: { select: { name: true } },
      warehouse: { select: { name: true, code: true } },
      zone: { select: { name: true, code: true } },
    },
  });

  if (assets.length > EXPORT_MAX_ROWS) {
    return NextResponse.json(
      { error: "Too many rows to export; apply more filters." },
      { status: 422 }
    );
  }

  const headers = ["Label ID", "Asset Type", "Owner", "Warehouse", "Zone", "Status", "Notes", "Last Updated"];
  const headerLine = headers.map(csvEscape).join(",");

  const rows = assets.map((a) => {
    const labelId = a.labelId;
    const assetType = a.assetType?.name ?? a.assetType?.code ?? "";
    const owner = a.client ? a.client.name : "Company";
    const warehouse = a.warehouse?.name ?? a.warehouse?.code ?? "";
    const zone = a.zone?.name ?? a.zone?.code ?? "";
    const statusVal = a.status;
    const notes = a.notes ?? "";
    const lastUpdated = formatLastUpdated(a.updatedAt);
    return [
      csvEscape(labelId),
      csvEscape(assetType),
      csvEscape(owner),
      csvEscape(warehouse),
      csvEscape(zone),
      csvEscape(statusVal),
      csvEscape(notes),
      csvEscape(lastUpdated),
    ].join(",");
  });

  const csv = [headerLine, ...rows].join("\n");
  const exportDate = new Date();
  const dateStr = exportDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `assets_export_${dateStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
