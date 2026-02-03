import { prisma } from "@/lib/db";

const STATUSES = ["in_use", "idle", "damaged", "lost"] as const;
const NOTES_MAX_LENGTH = 2000;

export type AssetCreateInput = {
  labelId: string;
  assetTypeId: number;
  clientId: number | null;
  warehouseId: number | null;
  zoneId: number | null;
  status: string;
  notes: string | null;
};

export type ValidationError = { status: 400 | 409 | 422; error: string };

export async function validateAssetCreate(
  orgId: number,
  input: AssetCreateInput,
  excludeAssetId?: number
): Promise<ValidationError | null> {
  const labelTrim = input.labelId.trim();
  if (!labelTrim) {
    return { status: 400, error: "Label ID is required." };
  }

  const existing = await prisma.asset.findFirst({
    where: {
      organizationId: orgId,
      labelId: labelTrim,
      ...(excludeAssetId != null ? { id: { not: excludeAssetId } } : {}),
    },
  });
  if (existing) {
    return { status: 409, error: "This label ID is already in use." };
  }

  if (!input.assetTypeId || !Number.isInteger(input.assetTypeId)) {
    return { status: 400, error: "Invalid asset type." };
  }
  const assetType = await prisma.assetType.findFirst({
    where: { id: input.assetTypeId, organizationId: orgId },
  });
  if (!assetType) {
    return { status: 400, error: "Invalid asset type." };
  }

  if (input.clientId != null) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, organizationId: orgId },
    });
    if (!client) {
      return { status: 400, error: "Invalid client." };
    }
  }

  if (input.warehouseId != null) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId: orgId },
    });
    if (!warehouse) {
      return { status: 400, error: "Invalid warehouse or zone." };
    }
  }

  if (input.zoneId != null) {
    if (input.warehouseId == null) {
      return { status: 400, error: "Warehouse is required when zone is set." };
    }
    const zone = await prisma.zone.findFirst({
      where: { id: input.zoneId, warehouseId: input.warehouseId },
    });
    if (!zone) {
      return { status: 400, error: "Zone does not belong to the selected warehouse." };
    }
  }

  if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) {
    return { status: 400, error: "Invalid status." };
  }

  if (input.notes != null && input.notes.length > NOTES_MAX_LENGTH) {
    return { status: 400, error: "Notes are too long." };
  }

  return null;
}

export function assetSnapshot(asset: {
  status: string;
  warehouseId: number | null;
  zoneId: number | null;
  clientId: number | null;
}): Record<string, unknown> {
  return {
    status: asset.status,
    warehouse_id: asset.warehouseId,
    zone_id: asset.zoneId,
    client_id: asset.clientId,
  };
}
