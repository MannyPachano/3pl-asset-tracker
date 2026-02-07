"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null; serialized?: boolean };
type Client = { id: number; name: string };
type Warehouse = { id: number; name: string; code: string | null };
type Zone = { id: number; warehouseId: number; name: string; code: string | null; warehouse?: Warehouse };
type AssetItem = {
  id: number;
  labelId: string;
  quantity?: number;
  status: string;
  updatedAt: string;
  assetType: AssetType;
  client: Client | null;
  warehouse: Warehouse | null;
  zone: Zone | null;
};

const STATUS_LABELS: Record<string, string> = {
  in_use: "In use",
  idle: "Idle",
  damaged: "Damaged",
  lost: "Lost",
};

export default function AssetsListPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkWarehouseId, setBulkWarehouseId] = useState("");
  const [bulkZoneId, setBulkZoneId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkClientId, setBulkClientId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

  useEffect(() => {
    const s = searchParams.get("status") ?? "";
    const c = searchParams.get("clientId") ?? "";
    if (s !== status) setStatus(s);
    if (c !== clientId) setClientId(c);
    setPage(1);
  }, [searchParams]);

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const loadOptions = useCallback(() => {
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
  }, []);

  const loadList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (assetTypeId) params.set("assetTypeId", assetTypeId);
    if (status) params.set("status", status);
    if (clientId === "company") params.set("clientId", "company");
    else if (clientId) params.set("clientId", clientId);
    if (warehouseId) params.set("warehouseId", warehouseId);
    if (zoneId) params.set("zoneId", zoneId);
    params.set("page", String(page));
    params.set("limit", String(limit));
    apiFetch(`/api/assets?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setError("Failed to load assets"))
      .finally(() => setLoading(false));
  }, [search, assetTypeId, status, clientId, warehouseId, zoneId, page, limit]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadList();
    }, 0);
    return () => clearTimeout(id);
  }, [loadList]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const ownerLabel = (a: AssetItem) => (a.client ? a.client.name : "Company-owned");
  const locationLabel = (a: AssetItem) => {
    if (a.warehouse && a.zone) return `${a.warehouse.name} / ${a.zone.name}`;
    if (a.warehouse) return a.warehouse.name;
    return "—";
  };

  const allOnPageSelected = items.length > 0 && items.every((a) => selectedIds.has(a.id));
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((a) => next.add(a.id));
        return next;
      });
    }
  }
  function openBulkModal() {
    setBulkWarehouseId("");
    setBulkZoneId("");
    setBulkStatus("");
    setBulkClientId("");
    setBulkError("");
    setBulkModalOpen(true);
  }
  function handleBulkUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBulkError("");
    const body: Record<string, unknown> = { assetIds: Array.from(selectedIds) };
    if (bulkWarehouseId) body.warehouseId = Number(bulkWarehouseId);
    if (bulkZoneId) body.zoneId = Number(bulkZoneId);
    if (bulkStatus) body.status = bulkStatus;
    if (bulkClientId === "company") body.clientId = null;
    else if (bulkClientId) body.clientId = Number(bulkClientId);
    if (!body.warehouseId && body.zoneId === undefined && !body.status && body.clientId === undefined) {
      setBulkError("Select at least one field to update.");
      return;
    }
    if (body.zoneId !== undefined && !body.warehouseId) {
      setBulkError("Select a warehouse when setting zone.");
      return;
    }
    setBulkSaving(true);
    apiFetch("/api/assets/bulk-update", { method: "POST", body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d?.error ?? "Bulk update failed")));
        return r.json();
      })
      .then((data: { updated: number }) => {
        setBulkModalOpen(false);
        setSelectedIds(new Set());
        loadList();
      })
      .catch((err) => setBulkError(err instanceof Error ? err.message : "Bulk update failed"))
      .finally(() => setBulkSaving(false));
  }

  const zonesForBulkWarehouse = bulkWarehouseId
    ? zones.filter((z) => z.warehouseId === Number(bulkWarehouseId))
    : [];

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Assets</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">See all your assets, filter by type or location, and add or change them. You can also move or update many at once with bulk update.</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 shrink-0 sm:mt-0">
          <Link href="/assets/new" className="btn-primary">
            Create asset
          </Link>
          <Link href="/assets/import" className="btn-secondary">
            Import CSV
          </Link>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-[var(--muted)]">{selectedIds.size} selected</span>
              <button type="button" onClick={openBulkModal} className="btn-primary">Bulk update</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="btn-secondary">Clear selection</button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by label ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadList())}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <select
          value={assetTypeId}
          onChange={(e) => setAssetTypeId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All types</option>
          {assetTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All statuses</option>
          <option value="in_use">In use</option>
          <option value="idle">Idle</option>
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All owners</option>
          <option value="company">Company-owned</option>
          <option value="client_owned">Client-owned</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setZoneId("");
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All locations</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          disabled={!warehouseId}
        >
          <option value="">All zones</option>
          {zones
            .filter((z) => !warehouseId || z.warehouseId === Number(warehouseId))
            .map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
        </select>
        <button
          type="button"
          onClick={() => { setPage(1); loadList(); }}
          className="btn-primary"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No assets match. <Link href="/assets/new" className="text-blue-600 hover:underline">Create one</Link>.
        </p>
      ) : (
        <>
          <table className="mt-4 w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-10 border border-gray-200 px-2 py-1 text-left">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all on page"
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Label ID</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Qty</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Type</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Owner</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Location</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Status</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Last updated</th>
                <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="w-10 border border-gray-200 px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      aria-label={`Select ${a.labelId}`}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-sm font-medium">{a.labelId}</td>
                  <td className="border border-gray-200 px-2 py-1 text-sm tabular-nums">
                    {(a.quantity ?? 1) > 1 || a.assetType?.serialized === false ? (a.quantity ?? 1) : "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-sm">{a.assetType?.name ?? "—"}</td>
                  <td className="border border-gray-200 px-2 py-1 text-sm">{ownerLabel(a)}</td>
                  <td className="border border-gray-200 px-2 py-1 text-sm">{locationLabel(a)}</td>
                  <td className="border border-gray-200 px-2 py-1 text-sm">{STATUS_LABELS[a.status] ?? a.status}</td>
                  <td className="border border-gray-200 px-2 py-1 text-sm">
                    {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1">
                    <Link href={`/assets/${a.id}`} className="text-sm text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-update-title">
          <div className="card max-w-md w-full p-6">
            <h2 id="bulk-update-title" className="text-lg font-semibold text-[var(--foreground)]">
              Bulk update {selectedIds.size} assets
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Set only the fields you want to change. Leave as &quot;No change&quot; to keep current value.
            </p>
            <form onSubmit={handleBulkUpdate} className="mt-4 space-y-4">
              {bulkError && <div className="alert-error" role="alert">{bulkError}</div>}
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Location (warehouse)</label>
                <select
                  value={bulkWarehouseId}
                  onChange={(e) => { setBulkWarehouseId(e.target.value); setBulkZoneId(""); }}
                  className="input"
                >
                  <option value="">No change</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Zone</label>
                <select
                  value={bulkZoneId}
                  onChange={(e) => setBulkZoneId(e.target.value)}
                  className="input"
                  disabled={!bulkWarehouseId}
                >
                  <option value="">No change</option>
                  {zonesForBulkWarehouse.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="input"
                >
                  <option value="">No change</option>
                  <option value="in_use">In use</option>
                  <option value="idle">Idle</option>
                  <option value="damaged">Damaged</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Owner</label>
                <select
                  value={bulkClientId}
                  onChange={(e) => setBulkClientId(e.target.value)}
                  className="input"
                >
                  <option value="">No change</option>
                  <option value="company">Company-owned</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={bulkSaving} className="btn-primary">
                  {bulkSaving ? "Updating…" : "Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}