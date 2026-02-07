import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReportWhere } from "@/lib/report-filters";

const PREVIEW_MAX_ROWS = 200;

export type ReportPreviewItem = {
  labelId: string;
  quantity: number;
  assetType: string;
  owner: string;
  warehouse: string;
  zone: string;
  status: string;
  notes: string;
  lastUpdated: string;
};

export async function GET(request: Request) {
  const session = await requireAuth(request);
  const result = await buildReportWhere(request, prisma, session.organizationId);
  if ("error" in result) return result.error;
  const { where } = result;

  const [total, assets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { labelId: "asc" }],
      take: PREVIEW_MAX_ROWS,
      include: {
        assetType: { select: { name: true, code: true } },
        client: { select: { name: true } },
        warehouse: { select: { name: true, code: true } },
        zone: { select: { name: true, code: true } },
      },
    }),
  ]);

  const items: ReportPreviewItem[] = assets.map((a) => ({
    labelId: a.labelId,
    quantity: a.quantity,
    assetType: a.assetType?.name ?? a.assetType?.code ?? "",
    owner: a.client ? a.client.name : "Company",
    warehouse: a.warehouse?.name ?? a.warehouse?.code ?? "",
    zone: a.zone?.name ?? a.zone?.code ?? "",
    status: a.status,
    notes: a.notes ?? "",
    lastUpdated: a.updatedAt.toISOString(),
  }));

  return NextResponse.json({ items, total });
}
