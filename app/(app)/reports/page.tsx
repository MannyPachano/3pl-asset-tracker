"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null };
type Client = { id: number; name: string };
type Warehouse = { id: number; name: string; code: string | null };
type Zone = { id: number; warehouseId: number; name: string; code: string | null };

type PreviewItem = {
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

const STATUS_LABELS: Record<string, string> = {
  in_use: "In use",
  idle: "Idle",
  damaged: "Damaged",
  lost: "Lost",
};

function formatPreviewDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const loadOptions = useCallback(() => {
    Promise.all([
      fetch("/api/asset-types", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/clients", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/warehouses", { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch("/api/zones", { headers: getAuthHeaders() }).then((r) => r.json()),
    ])
      .then(([types, cl, wh, zn]) => {
        setAssetTypes(types);
        setClients(cl);
        setWarehouses(wh);
        setZones(zn);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (assetTypeId) params.set("assetTypeId", assetTypeId);
    if (status) params.set("status", status);
    if (clientId === "company") params.set("clientId", "company");
    else if (clientId === "client_owned") params.set("clientId", "client_owned");
    else if (clientId) params.set("clientId", clientId);
    if (warehouseId) params.set("warehouseId", warehouseId);
    if (zoneId) params.set("zoneId", zoneId);
    return params;
  }

  function loadPreview() {
    setPreviewError("");
    setPreviewLoading(true);
    fetch(`/api/reports/preview?${buildParams().toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((body) => Promise.reject(new Error(body?.error ?? "Failed to load preview")));
        return res.json();
      })
      .then((data: { items: PreviewItem[]; total: number }) => {
        setPreviewItems(data.items ?? []);
        setPreviewTotal(data.total ?? 0);
      })
      .catch((err) => setPreviewError(err instanceof Error ? err.message : "Failed to load preview"))
      .finally(() => setPreviewLoading(false));
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExport() {
    setError("");
    setExporting(true);
    fetch(`/api/reports/export?${buildParams().toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        const disposition = res.headers.get("Content-Disposition");
        let filename = "assets_export.csv";
        if (disposition) {
          const match = /filename="?([^";\n]+)"?/.exec(disposition);
          if (match) filename = match[1].trim();
        }
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body?.error ?? "Export failed");
          });
        }
        return res.blob().then((blob) => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        triggerDownload(blob, filename);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Export failed");
      })
      .finally(() => setExporting(false));
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Reports</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Apply filters to preview assets, then export to CSV. Date range filters by last updated.
      </p>
      {error && <div className="mt-4 alert-error" role="alert">{error}</div>}
      {previewError && <div className="mt-4 alert-error" role="alert">{previewError}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">From date (updated)</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">To date (updated)</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Asset type</label>
          <select
            value={assetTypeId}
            onChange={(e) => setAssetTypeId(e.target.value)}
            className="input"
          >
            <option value="">All types</option>
            {assetTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            <option value="">All statuses</option>
            <option value="in_use">In use</option>
            <option value="idle">Idle</option>
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Owner</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input"
          >
            <option value="">All owners</option>
            <option value="company">Company-owned</option>
            <option value="client_owned">Client-owned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
            <option value="">All locations</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
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
            <option value="">All zones</option>
            {zones
              .filter((z) => !warehouseId || z.warehouseId === Number(warehouseId))
              .map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={loadPreview}
          disabled={previewLoading}
          className="btn-primary disabled:opacity-50"
        >
          {previewLoading ? (
            <span className="flex items-center gap-2">
              <span className="spinner" aria-hidden /> Loading…
            </span>
          ) : (
            "Apply filters"
          )}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Preview</h2>
          {previewTotal !== null && (
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {previewTotal === 0
                ? "No assets match the current filters."
                : previewItems && previewItems.length < previewTotal
                  ? `Showing first ${previewItems.length} of ${previewTotal} assets. Export CSV for full data.`
                  : `${previewTotal} asset${previewTotal === 1 ? "" : "s"}.`}
            </p>
          )}
        </div>
        {previewLoading && previewItems === null ? (
          <div className="flex items-center justify-center gap-3 py-12 text-[var(--muted)]">
            <div className="spinner" aria-hidden />
            <span className="text-sm">Loading preview…</span>
          </div>
        ) : !previewItems || previewItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted)]">
            {previewTotal === 0 && previewItems ? "No assets match the current filters." : "Click Apply filters to preview results."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Label ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Asset type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Warehouse</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {previewItems.map((row, i) => (
                  <tr key={`${row.labelId}-${i}`} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)]/20">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{row.labelId}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--foreground)]">{row.quantity}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.assetType}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.owner}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.warehouse || "—"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.zone || "—"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{STATUS_LABELS[row.status] ?? row.status}</td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-sm text-[var(--muted)]" title={row.notes}>{row.notes || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--muted)]">{formatPreviewDate(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
