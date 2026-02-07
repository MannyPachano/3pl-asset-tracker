"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null; serialized?: boolean };
type Client = { id: number; name: string };
type Warehouse = { id: number; name: string; code: string | null };
type Zone = { id: number; warehouseId: number; name: string; code: string | null };
type Asset = {
  id: number;
  labelId: string;
  quantity: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assetType: AssetType;
  client: Client | null;
  warehouse: Warehouse | null;
  zone: Zone | null;
};
type HistoryEntry = {
  id: number;
  changedAt: string;
  user: string;
  snapshot: Record<string, unknown>;
};

const STATUS_LABELS: Record<string, string> = {
  in_use: "In use",
  idle: "Idle",
  damaged: "Damaged",
  lost: "Lost",
};

const STATUS_OPTIONS = [
  { value: "in_use", label: "In use" },
  { value: "idle", label: "Idle" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
];

/**
 * Describes what changed in this revision by diffing current snapshot with the previous one.
 * Only includes fields that actually changed; avoids repeating "Owner updated" etc. on every line.
 */
function snapshotSummary(
  snapshot: Record<string, unknown>,
  previousSnapshot: Record<string, unknown> | null
): string {
  const parts: string[] = [];

  const status = snapshot.status != null ? String(snapshot.status) : null;
  const prevStatus = previousSnapshot?.status != null ? String(previousSnapshot.status) : null;
  if (status !== prevStatus && status) {
    parts.push(`Status: ${STATUS_LABELS[status] ?? status}`);
  }

  const wh = snapshot.warehouse_id ?? null;
  const z = snapshot.zone_id ?? null;
  const prevWh = previousSnapshot?.warehouse_id ?? null;
  const prevZ = previousSnapshot?.zone_id ?? null;
  if (wh !== prevWh || z !== prevZ) {
    parts.push("Location updated");
  }

  const clientId = snapshot.client_id ?? null;
  const prevClientId = previousSnapshot?.client_id ?? null;
  if (clientId !== prevClientId) {
    parts.push("Owner updated");
  }

  const quantity = snapshot.quantity ?? 1;
  const prevQuantity = previousSnapshot?.quantity ?? 1;
  if (quantity !== prevQuantity) {
    parts.push("Quantity updated");
  }

  const notes = snapshot.notes ?? null;
  const prevNotes = previousSnapshot?.notes ?? null;
  if (notes !== prevNotes) {
    parts.push("Notes updated");
  }

  return parts.length ? parts.join(" · ") : "Updated";
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [labelId, setLabelId] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [owner, setOwner] = useState<"company" | "client">("company");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [status, setStatus] = useState("in_use");
  const [notes, setNotes] = useState("");

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const loadAsset = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/assets/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((a) => {
        setAsset(a);
        setLabelId(a.labelId);
        setAssetTypeId(String(a.assetType?.id ?? ""));
        setQuantity(a.quantity ?? 1);
        setOwner(a.client ? "client" : "company");
        setClientId(a.client ? String(a.client.id) : "");
        setWarehouseId(a.warehouse ? String(a.warehouse.id) : "");
        setZoneId(a.zone ? String(a.zone.id) : "");
        setStatus(a.status);
        setNotes(a.notes ?? "");
      })
      .catch(() => setError("Asset not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const loadHistory = useCallback(() => {
    if (!id) return;
    apiFetch(`/api/assets/${id}/history`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data) => setHistory(data.items ?? []))
      .catch(() => setHistory([]));
  }, [id]);

  useEffect(() => {
    loadAsset();
    loadHistory();
  }, [loadAsset, loadHistory]);

  useEffect(() => {
    const tid = setTimeout(() => {
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
        .catch(() => {});
    }, 0);
    return () => clearTimeout(tid);
  }, []);

  const zonesForWarehouse = warehouseId
    ? zones.filter((z) => z.warehouseId === Number(warehouseId))
    : [];

  function cancelEdit() {
    if (asset) {
      setLabelId(asset.labelId);
      setAssetTypeId(String(asset.assetType?.id ?? ""));
      setQuantity(asset.quantity ?? 1);
      setOwner(asset.client ? "client" : "company");
      setClientId(asset.client ? String(asset.client.id) : "");
      setWarehouseId(asset.warehouse ? String(asset.warehouse.id) : "");
      setZoneId(asset.zone ? String(asset.zone.id) : "");
      setStatus(asset.status);
      setNotes(asset.notes ?? "");
    }
    setEditMode(false);
    setError("");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!labelId.trim() || !assetTypeId) {
      setError("Label ID and asset type are required.");
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
    setSaveLoading(true);
    const selectedType = assetTypes.find((t) => t.id === Number(assetTypeId));
    const isNonSerialized = selectedType && selectedType.serialized === false;
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
    apiFetch(`/api/assets/${id}`, { method: "PUT", body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        return r.json();
      })
      .then((updated) => {
        setAsset(updated);
        setEditMode(false);
        loadHistory();
      })
      .catch((d) => {
        setError(d?.error ?? "Failed to save");
      })
      .finally(() => setSaveLoading(false));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }
  if (error && !asset) {
    return (
      <div>
        <Link href="/assets" className="text-sm text-blue-600 hover:underline">← Assets</Link>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!asset) {
    return null;
  }

  const locationLabel = asset.warehouse && asset.zone
    ? `${asset.warehouse.name} / ${asset.zone.name}`
    : asset.warehouse
      ? asset.warehouse.name
      : "—";

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/assets" className="hover:underline">Assets</Link>
        <span>/</span>
        <span>{asset.labelId}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{asset.labelId}</h1>
        {!editMode ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="btn-primary"
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-800 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      {editMode ? (
        <form onSubmit={handleSave} className="mt-4 max-w-xl space-y-4 rounded border border-gray-200 bg-white p-4">
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
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {assetTypes.find((t) => t.id === Number(assetTypeId))?.serialized === false && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="mt-1 w-24 rounded border border-gray-300 px-2 py-1"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Owner *</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1">
                <input type="radio" name="owner" checked={owner === "company"} onChange={() => setOwner("company")} />
                Company-owned
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="owner" checked={owner === "client"} onChange={() => setOwner("client")} />
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
              onChange={(e) => { setWarehouseId(e.target.value); setZoneId(""); }}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
            >
              <option value="">None</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
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
                <option key={z.id} value={z.id}>{z.name}</option>
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
          <button
            type="submit"
            disabled={saveLoading}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {saveLoading ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <dl className="mt-4 grid gap-2 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Label ID</dt>
            <dd className="font-medium">{asset.labelId}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Type</dt>
            <dd>{asset.assetType?.name ?? "—"}</dd>
          </div>
          {((asset.quantity ?? 1) > 1 || asset.assetType?.serialized === false) && (
            <div>
              <dt className="text-sm text-gray-500">Quantity</dt>
              <dd>{asset.quantity ?? 1}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Owner</dt>
            <dd>{asset.client ? asset.client.name : "Company-owned"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Location</dt>
            <dd>{locationLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>{STATUS_LABELS[asset.status] ?? asset.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd>{asset.createdAt ? new Date(asset.createdAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Last updated</dt>
            <dd>{asset.updatedAt ? new Date(asset.updatedAt).toLocaleString() : "—"}</dd>
          </div>
          {asset.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Notes</dt>
              <dd className="whitespace-pre-wrap">{asset.notes}</dd>
            </div>
          )}
        </dl>
      )}

      {!editMode && history.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-gray-900">Recent changes</h2>
          <ul className="mt-2 space-y-1 rounded border border-gray-200 bg-white p-4">
            {history.map((h, i) => {
              const previousSnapshot = history[i + 1]?.snapshot ?? null;
              return (
                <li key={h.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="text-gray-600">
                    {new Date(h.changedAt).toLocaleString()}
                  </span>
                  <span className="text-gray-500">by {h.user}</span>
                  <span className="text-gray-700">{snapshotSummary(h.snapshot, previousSnapshot)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}