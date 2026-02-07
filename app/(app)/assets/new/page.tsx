"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null; serialized?: boolean };
type Client = { id: number; name: string };
type Warehouse = { id: number; name: string; code: string | null };
type Zone = { id: number; warehouseId: number; name: string; code: string | null };

const STATUS_OPTIONS = [
  { value: "in_use", label: "In use" },
  { value: "idle", label: "Idle" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
];

export default function NewAssetPage() {
  const router = useRouter();
  const [labelId, setLabelId] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [owner, setOwner] = useState<"company" | "client">("company");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState("in_use");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      Promise.all([
        apiFetch("/api/asset-types").then((r) => r.json()),
        apiFetch("/api/clients").then((r) => r.json()),
        apiFetch("/api/warehouses").then((r) => r.json()),
        apiFetch("/api/zones").then((r) => r.json()),
      ])
        .then(([types, cl, wh, zn]) => {
          setAssetTypes(types);
          setClients(cl);
          setWarehouses(wh);
          setZones(zn);
        })
        .catch(() => setError("Failed to load options"));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const zonesForWarehouse = warehouseId
    ? zones.filter((z) => z.warehouseId === Number(warehouseId))
    : [];
  const selectedAssetType = assetTypes.find((t) => t.id === Number(assetTypeId));
  const isNonSerialized = selectedAssetType && selectedAssetType.serialized === false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!labelId.trim()) {
      setError("Label ID is required.");
      return;
    }
    if (!assetTypeId) {
      setError("Asset type is required.");
      return;
    }
    if (owner === "client" && !clientId) {
      setError("Select a client when client-owned.");
      return;
    }
    if (zoneId && !warehouseId) {
      setError("Warehouse is required when zone is set.");
      return;
    }
    setLoading(true);
    const body = {
      label_id: labelId.trim(),
      asset_type_id: Number(assetTypeId),
      quantity: isNonSerialized ? Math.max(1, quantity) : 1,
      client_id: owner === "company" ? null : Number(clientId),
      warehouse_id: warehouseId ? Number(warehouseId) : null,
      zone_id: zoneId ? Number(zoneId) : null,
      status,
      notes: notes.trim() || null,
    };
    apiFetch("/api/assets", { method: "POST", body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        return r.json();
      })
      .then((asset) => {
        router.replace(`/assets/${asset.id}`);
      })
      .catch((d) => {
        setError(d?.error ?? "Failed to create asset");
        setLoading(false);
      });
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-[var(--muted)]" aria-label="Breadcrumb">
        <Link href="/assets" className="transition-colors hover:text-[var(--foreground)]">Assets</Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--foreground)]">New asset</span>
      </nav>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Create asset</h1>
      {error && <div className="mt-4 alert-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="card mt-6 max-w-xl space-y-5 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Label ID *</label>
          <input
            type="text"
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Asset type *</label>
          <select
            value={assetTypeId}
            onChange={(e) => setAssetTypeId(e.target.value)}
            className="input"
            required
          >
            <option value="">Select</option>
            {assetTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
            ))}
          </select>
        </div>
        {isNonSerialized && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Quantity *</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="input w-24"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Owner *</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="owner"
                checked={owner === "company"}
                onChange={() => setOwner("company")}
                className="text-[var(--primary)]"
              />
              <span className="text-sm">Company-owned</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="owner"
                checked={owner === "client"}
                onChange={() => setOwner("client")}
                className="text-[var(--primary)]"
              />
              <span className="text-sm">Client-owned</span>
            </label>
          </div>
          {owner === "client" && (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input mt-2"
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Warehouse</label>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setZoneId("");
            }}
            className="input"
          >
            <option value="">None</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Zone</label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="input"
            disabled={!warehouseId}
          >
            <option value="">None</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>{z.name}{z.code ? ` (${z.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Status *</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
            required
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="input resize-y"
            maxLength={2000}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner" aria-hidden /> Creating…
              </span>
            ) : (
              "Create"
            )}
          </button>
          <Link href="/assets" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}