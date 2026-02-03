/**
 * CSV import: header normalization, row validation, and resolution using org lookups.
 * Does not touch DB for inserts; returns valid rows and errors. Caller inserts and does not write AssetHistory.
 */

const NOTES_MAX_LENGTH = 2000;
const STATUSES = ["in_use", "idle", "damaged", "lost"] as const;

const HEADER_ALIASES: Record<string, string> = {
  label_id: "label_id",
  "label id": "label_id",
  labelid: "label_id",
  asset_type: "asset_type",
  "asset type": "asset_type",
  assettype: "asset_type",
  type: "asset_type",
  status: "status",
  client: "client",
  owner: "client",
  warehouse: "warehouse",
  warehouse_name: "warehouse",
  zone: "zone",
  zone_name: "zone",
  notes: "notes",
};

export type ImportLookups = {
  assetTypes: { byName: Map<string, number>; byCode: Map<string, number> };
  clients: Map<string, number>;
  warehouses: { byName: Map<string, number>; byCode: Map<string, number> };
  zones: Map<string, { warehouseId: number; zoneId: number }>; // key: "warehouseId_zoneName" etc
  existingLabelIds: Set<string>;
};

export type ImportRow = {
  labelId: string;
  assetTypeId: number;
  clientId: number | null;
  warehouseId: number | null;
  zoneId: number | null;
  status: string;
  notes: string | null;
};

export type ImportError = {
  row: number;
  label_id: string;
  message: string;
};

export type ImportResult = {
  validRows: ImportRow[];
  errors: ImportError[];
};

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, " ");
  return HEADER_ALIASES[key] ?? key;
}

function getCell(row: string[], headerIndex: Map<string, number>, canonical: string): string {
  const idx = headerIndex.get(canonical);
  if (idx == null) return "";
  const v = row[idx];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Resolve asset type by name or code (case-insensitive). Returns id or null if not exactly one match.
 */
function resolveAssetType(
  value: string,
  lookups: ImportLookups
): number | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const byName = lookups.assetTypes.byName.get(lower);
  const byCode = lookups.assetTypes.byCode.get(lower);
  if (byName != null && byCode != null && byName !== byCode) return null; // ambiguous
  if (byName != null) return byName;
  if (byCode != null) return byCode;
  return null;
}

/**
 * Resolve client by name (case-insensitive). Returns id or null.
 */
function resolveClient(value: string, lookups: ImportLookups): number | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return lookups.clients.get(lower) ?? null;
}

/**
 * Resolve warehouse by name or code. Returns id or null.
 */
function resolveWarehouse(value: string, lookups: ImportLookups): number | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const byName = lookups.warehouses.byName.get(lower);
  const byCode = lookups.warehouses.byCode.get(lower);
  if (byName != null && byCode != null && byName !== byCode) return null;
  if (byName != null) return byName;
  if (byCode != null) return byCode;
  return null;
}

/**
 * Resolve zone by name/code within warehouse. Key in lookups is "warehouseId_zoneKey".
 */
function resolveZone(
  value: string,
  warehouseId: number,
  lookups: ImportLookups
): number | null {
  if (!value) return null;
  const key = `${warehouseId}_${value.toLowerCase()}`;
  const entry = lookups.zones.get(key);
  return entry ? entry.zoneId : null;
}

/**
 * Validate and resolve one row. Returns either { row } or { errors }.
 */
function validateRow(
  dataRowIndex: number,
  fileRowNumber: number,
  row: string[],
  headerIndex: Map<string, number>,
  lookups: ImportLookups,
  labelIdsInFile: Set<string>
): { row?: ImportRow; errors?: string[] } {
  const errors: string[] = [];
  const labelId = getCell(row, headerIndex, "label_id");
  const assetTypeVal = getCell(row, headerIndex, "asset_type");
  const statusVal = getCell(row, headerIndex, "status");
  const clientVal = getCell(row, headerIndex, "client");
  const warehouseVal = getCell(row, headerIndex, "warehouse");
  const zoneVal = getCell(row, headerIndex, "zone");
  const notesVal = getCell(row, headerIndex, "notes");

  if (!labelId) errors.push("label_id is required");
  if (!assetTypeVal) errors.push("asset_type is required");
  if (!statusVal) errors.push("status is required");

  if (errors.length > 0) {
    return { errors };
  }

  const labelTrim = labelId.trim();
  if (labelIdsInFile.has(labelTrim)) {
    errors.push("Duplicate label_id in file.");
    return { errors };
  }
  if (lookups.existingLabelIds.has(labelTrim)) {
    errors.push("Label ID already exists.");
    return { errors };
  }

  const assetTypeId = resolveAssetType(assetTypeVal, lookups);
  if (assetTypeId == null) {
    errors.push("asset_type could not be resolved to a single Asset Type in your organization.");
    return { errors };
  }

  let clientId: number | null = null;
  if (clientVal) {
    const c = resolveClient(clientVal, lookups);
    if (c == null) {
      errors.push("client could not be resolved to a single Client in your organization.");
      return { errors };
    }
    clientId = c;
  }

  let warehouseId: number | null = null;
  let zoneId: number | null = null;
  if (zoneVal && !warehouseVal) {
    errors.push("warehouse is required when zone is set.");
    return { errors };
  }
  if (warehouseVal) {
    const wh = resolveWarehouse(warehouseVal, lookups);
    if (wh == null) {
      errors.push("warehouse could not be resolved to a single Warehouse in your organization.");
      return { errors };
    }
    warehouseId = wh;
    if (zoneVal) {
      const z = resolveZone(zoneVal, warehouseId, lookups);
      if (z == null) {
        errors.push("zone could not be resolved to a single Zone in that warehouse.");
        return { errors };
      }
      zoneId = z;
    }
  }

  const statusNorm = statusVal.trim().toLowerCase();
  if (!STATUSES.includes(statusNorm as (typeof STATUSES)[number])) {
    errors.push("status must be one of: in_use, idle, damaged, lost.");
    return { errors };
  }

  if (notesVal && notesVal.length > NOTES_MAX_LENGTH) {
    errors.push("notes are too long.");
    return { errors };
  }

  labelIdsInFile.add(labelTrim);
  return {
    row: {
      labelId: labelTrim,
      assetTypeId,
      clientId,
      warehouseId,
      zoneId,
      status: statusNorm,
      notes: notesVal || null,
    },
  };
}

/**
 * Build header index from first row (canonical names). Returns null if required columns missing.
 */
function buildHeaderIndex(headers: string[]): Map<string, number> | null {
  const index = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    const canon = normalizeHeader(headers[i]);
    if (canon) index.set(canon, i);
  }
  const required = ["label_id", "asset_type", "status"];
  for (const r of required) {
    if (!index.has(r)) return null;
  }
  return index;
}

/**
 * Process parsed CSV rows (first row = header). Uses lookups for resolution.
 * Duplicate label_id in file: fail only subsequent rows (first wins).
 */
export function validateImportRows(
  rows: string[][],
  lookups: ImportLookups
): ImportResult {
  const validRows: ImportRow[] = [];
  const errors: ImportError[] = [];
  if (rows.length === 0) {
    return { validRows, errors };
  }
  const [headerRow, ...dataRows] = rows;
  const headerIndex = buildHeaderIndex(headerRow);
  if (!headerIndex) {
    return {
      validRows: [],
      errors: [{ row: 1, label_id: "", message: "Invalid header: missing required column (label_id, asset_type, or status)." }],
    };
  }

  const labelIdsInFile = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const fileRowNumber = i + 2; // 1-based, row 2 = first data row
    const result = validateRow(
      i,
      fileRowNumber,
      dataRows[i],
      headerIndex,
      lookups,
      labelIdsInFile
    );
    const labelId = getCell(dataRows[i], headerIndex, "label_id") || "(empty)";
    if (result.errors && result.errors.length > 0) {
      errors.push({
        row: fileRowNumber,
        label_id: labelId,
        message: result.errors.join(" "),
      });
    } else if (result.row) {
      validRows.push(result.row);
    }
  }

  return { validRows, errors };
}
