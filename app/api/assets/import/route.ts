import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCsvLines } from "@/lib/csv-parse";
import {
  validateImportRows,
  type ImportLookups,
} from "@/lib/csv-import";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DATA_ROWS = 10_000;

/**
 * Build lookups for CSV import: asset types, clients, warehouses, zones (by name/code, case-insensitive).
 * Only map when unique (ambiguous names/codes are not mapped so resolution fails).
 */
async function buildLookups(organizationId: number): Promise<ImportLookups> {
  const [assetTypes, clients, warehouses, zones, existingAssets] = await Promise.all([
    prisma.assetType.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true, serialized: true },
    }),
    prisma.client.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true },
    }),
    prisma.zone.findMany({
      select: { id: true, warehouseId: true, name: true, code: true },
      where: { warehouse: { organizationId } },
    }),
    prisma.asset.findMany({
      where: { organizationId },
      select: { labelId: true },
    }),
  ]);

  const assetTypesByName = new Map<string, number>();
  const assetTypesByCode = new Map<string, number>();
  const assetTypeSerializedById = new Map<number, boolean>();
  for (const t of assetTypes) {
    const nk = t.name.trim().toLowerCase();
    if (assetTypesByName.has(nk)) assetTypesByName.delete(nk);
    else assetTypesByName.set(nk, t.id);
    if (t.code != null && t.code.trim() !== "") {
      const ck = t.code.trim().toLowerCase();
      if (assetTypesByCode.has(ck)) assetTypesByCode.delete(ck);
      else assetTypesByCode.set(ck, t.id);
    }
    assetTypeSerializedById.set(t.id, t.serialized);
  }

  const clientNames = new Map<string, number>();
  for (const c of clients) {
    const k = c.name.trim().toLowerCase();
    if (clientNames.has(k)) clientNames.delete(k);
    else clientNames.set(k, c.id);
  }

  const whByName = new Map<string, number>();
  const whByCode = new Map<string, number>();
  for (const w of warehouses) {
    const nk = w.name.trim().toLowerCase();
    if (whByName.has(nk)) whByName.delete(nk);
    else whByName.set(nk, w.id);
    if (w.code != null && w.code.trim() !== "") {
      const ck = w.code.trim().toLowerCase();
      if (whByCode.has(ck)) whByCode.delete(ck);
      else whByCode.set(ck, w.id);
    }
  }

  const zoneMap = new Map<string, { warehouseId: number; zoneId: number }>();
  for (const z of zones) {
    const nk = `${z.warehouseId}_${z.name.trim().toLowerCase()}`;
    if (zoneMap.has(nk)) zoneMap.delete(nk);
    else zoneMap.set(nk, { warehouseId: z.warehouseId, zoneId: z.id });
    if (z.code != null && z.code.trim() !== "") {
      const ck = `${z.warehouseId}_${z.code.trim().toLowerCase()}`;
      if (zoneMap.has(ck)) zoneMap.delete(ck);
      else zoneMap.set(ck, { warehouseId: z.warehouseId, zoneId: z.id });
    }
  }

  const existingLabelIds = new Set(existingAssets.map((a) => a.labelId.trim()));

  return {
    assetTypes: { byName: assetTypesByName, byCode: assetTypesByCode, serializedById: assetTypeSerializedById },
    clients: clientNames,
    warehouses: { byName: whByName, byCode: whByCode },
    zones: zoneMap,
    existingLabelIds,
  };
}

/**
 * POST /api/assets/import — CSV file upload. Auth required. Partial success: insert valid rows, return errors for invalid.
 * No AssetHistory written. Max file size 5 MB, max 10,000 data rows.
 */
export async function POST(request: Request) {
  const session = await requireAuth(request);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Request must be multipart/form-data with a file." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body." },
      { status: 400 }
    );
  }

  const file = formData.get("file") ?? formData.get("csv");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Use field name 'file' or 'csv'." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { message: "File too large. Maximum size is 5 MB." },
      { status: 413 }
    );
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json(
      { message: "File could not be read as UTF-8." },
      { status: 422 }
    );
  }

  const rows = parseCsvLines(text);
  if (rows.length < 1) {
    return NextResponse.json(
      { message: "File has no header row." },
      { status: 422 }
    );
  }

  const dataRowCount = rows.length - 1;
  if (dataRowCount > MAX_DATA_ROWS) {
    return NextResponse.json(
      { message: `Import exceeds maximum of ${MAX_DATA_ROWS} rows.` },
      { status: 422 }
    );
  }

  let lookups: ImportLookups;
  try {
    lookups = await buildLookups(session.organizationId);
  } catch {
    return NextResponse.json(
      { error: "Failed to load organization data." },
      { status: 500 }
    );
  }

  const { validRows, errors } = validateImportRows(rows, lookups);

  if (validRows.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const r of validRows) {
          await tx.asset.create({
            data: {
              organizationId: session.organizationId,
              labelId: r.labelId,
              assetTypeId: r.assetTypeId,
              quantity: r.quantity,
              clientId: r.clientId,
              warehouseId: r.warehouseId,
              zoneId: r.zoneId,
              status: r.status,
              notes: r.notes,
            },
          });
        }
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to create assets. Please try again." },
        { status: 500 }
      );
    }
  }

  const total_rows = dataRowCount;
  const imported = validRows.length;
  const failed = errors.length;

  if (failed > 0 && imported === 0) {
    return NextResponse.json(
      { total_rows, imported: 0, failed, errors },
      { status: 422 }
    );
  }

  return NextResponse.json({
    total_rows,
    imported,
    failed,
    errors,
  });
}
