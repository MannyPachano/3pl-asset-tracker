"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null };
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
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/assets" className="hover:underline">Assets</Link>
        <span>/</span>
        <span>New asset</span>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Create asset</h1>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-4 max-w-xl space-y-4 rounded border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Label ID *</label>
          <input
            type="text"
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Asset type *</label>
          <select
            value={assetTypeId}
            onChange={(e) => setAssetTypeId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            required
          >
            <option value="">Select</option>
            {assetTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner *</label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="owner"
                checked={owner === "company"}
                onChange={() => setOwner("company")}
              />
              Company-owned
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="owner"
                checked={owner === "client"}
                onChange={() => setOwner("client")}
              />
              Client-owned
            </label>
          </div>
          {owner === "client" && (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1"
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
          <label className="block text-sm font-medium text-gray-700">Warehouse</label>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setZoneId("");
            }}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
          >
            <option value="">None</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Zone</label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            disabled={!warehouseId}
          >
            <option value="">None</option>
            {zonesForWarehouse.map((z) => (
              <option key={z.id} value={z.id}>{z.name}{z.code ? ` (${z.code})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status *</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            required
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            maxLength={2000}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create"}
          </button>
          <Link
            href="/assets"
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}