import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReportWhere } from "@/lib/report-filters";

const EXPORT_MAX_ROWS = 50_000;

function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatLastUpdated(date: Date): string {
  return date.toISOString();
}

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const result = await buildReportWhere(request, prisma, session.organizationId);
  if ("error" in result) return result.error;
  const { where } = result;

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
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `assets_export_${dateStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
