-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN "serialized" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
