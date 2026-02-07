"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth-client";

type AssetType = { id: number; name: string; code: string | null };
type Client = { id: number; name: string };
type Warehouse = { id: number; name: string; code: string | null };
type Zone = { id: number; warehouseId: number; name: string; code: string | null };

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

    fetch(`/api/reports/export?${params.toString()}`, {
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
      <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
      <p className="mt-1 text-sm text-gray-600">
        Apply filters and export assets to CSV. Date range filters by last updated.
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">From date (updated)</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">To date (updated)</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Asset type</label>
          <select
            value={assetTypeId}
            onChange={(e) => setAssetTypeId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All types</option>
            {assetTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            <option value="in_use">In use</option>
            <option value="idle">Idle</option>
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
          <label className="block text-sm font-medium text-gray-700">Warehouse</label>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setZoneId("");
            }}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All warehouses</option>
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
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
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

      <div className="mt-6">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
    </div>
  );
}
