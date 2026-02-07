"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

type Warehouse = { id: number; name: string; code: string | null };
type Zone = {
  id: number;
  warehouseId: number;
  name: string;
  code: string | null;
  warehouse: Warehouse;
  assetsCount?: number;
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch("/api/zones").then((r) => r.json()),
      apiFetch("/api/warehouses").then((r) => r.json()),
    ])
      .then(([zList, wList]) => {
        setZones(zList);
        setWarehouses(wList);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditingId(null);
    setWarehouseId(warehouses[0]?.id ? String(warehouses[0].id) : "");
    setName("");
    setCode("");
    setError("");
    setDeleteError("");
    setFormVisible(true);
  }

  function openEdit(z: Zone) {
    setEditingId(z.id);
    setWarehouseId(String(z.warehouseId));
    setName(z.name);
    setCode(z.code ?? "");
    setError("");
    setDeleteError("");
    setFormVisible(true);
  }

  function cancelForm() {
    setFormVisible(false);
    setEditingId(null);
    setName("");
    setCode("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const wid = Number(warehouseId);
    if (!Number.isInteger(wid) || wid < 1) {
      setError("Select a warehouse");
      return;
    }
    setSaveLoading(true);
    const body = { warehouseId: wid, name: name.trim(), code: code.trim() || undefined };
    const url = "/api/zones" + (editingId ? `/${editingId}` : "");
    const method = editingId ? "PUT" : "POST";
    apiFetch(url, { method, body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
      })
      .then(() => {
        cancelForm();
        load();
      })
      .catch((d) => setError(d?.error ?? "Failed to save"))
      .finally(() => setSaveLoading(false));
  }

  function handleDelete(z: Zone) {
    if (!confirm("Delete this zone?")) return;
    setDeleteError("");
    apiFetch(`/api/zones/${z.id}`, { method: "DELETE" })
      .then((r) => {
        if (r.status === 409) return r.json().then((d) => Promise.reject(d));
        if (!r.ok) throw new Error("Delete failed");
      })
      .then(() => load())
      .catch((d) =>
        setDeleteError(d?.error ?? "Cannot delete: assets use this zone")
      );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Zones</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}

      {formVisible && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-medium text-gray-700">
            {editingId ? "Edit zone" : "Add zone"}
          </h2>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm text-gray-600">Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-2 py-1"
                required
              >
                <option value="">Select</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.code ? ` (${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-2 py-1"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-2 py-1"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saveLoading}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {saveLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-4">
        {!formVisible && (
          <button
            type="button"
            onClick={openAdd}
            disabled={warehouses.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            Add zone
          </button>
        )}
      </div>
      {warehouses.length === 0 && !loading && (
        <p className="mt-2 text-sm text-gray-500">Add a warehouse first.</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : zones.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No zones yet.</p>
      ) : (
        <table className="mt-4 w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Warehouse</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Name</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Code</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Assets</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td className="border border-gray-200 px-2 py-1 text-sm">{z.warehouse?.name ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{z.name}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{z.code ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{z.assetsCount ?? 0}</td>
                <td className="border border-gray-200 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => openEdit(z)}
                    className="mr-2 text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(z)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
