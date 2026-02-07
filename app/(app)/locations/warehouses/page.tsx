"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

type Warehouse = {
  id: number;
  name: string;
  code: string | null;
  zonesCount?: number;
  assetsCount?: number;
};

export default function WarehousesPage() {
  const [list, setList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/api/warehouses")
      .then((r) => r.json())
      .then(setList)
      .catch(() => setError("Failed to load locations"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditingId(null);
    setName("");
    setCode("");
    setError("");
    setDeleteError("");
    setFormVisible(true);
  }

  function openEdit(w: Warehouse) {
    setEditingId(w.id);
    setName(w.name);
    setCode(w.code ?? "");
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
    setSaveLoading(true);
    const body = { name: name.trim(), code: code.trim() || undefined };
    const url = "/api/warehouses" + (editingId ? `/${editingId}` : "");
    const method = editingId ? "PUT" : "POST";
    apiFetch(url, { method, body: JSON.stringify(body) })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
      })
      .then(() => {
        cancelForm();
        load();
        setSuccessMessage(editingId ? "Warehouse updated." : "Warehouse added.");
        setError("");
        setDeleteError("");
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch((d) => setError(d?.error ?? "Failed to save"))
      .finally(() => setSaveLoading(false));
  }

  function handleDelete(w: Warehouse) {
    if (!confirm("Delete this location?")) return;
    setDeleteError("");
    apiFetch(`/api/warehouses/${w.id}`, { method: "DELETE" })
      .then((r) => {
        if (r.status === 409) return r.json().then((d) => Promise.reject(d));
        if (!r.ok) throw new Error("Delete failed");
      })
      .then(() => load())
      .catch((d) =>
        setDeleteError(d?.error ?? "Cannot delete: this location has zones or assets")
      );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Locations</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Manage locations</p>
        </div>
        {!formVisible && (
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary mt-2 shrink-0 sm:mt-0"
          >
            Add location
          </button>
        )}
      </div>

      {error && <div className="mt-4 alert-error" role="alert">{error}</div>}
      {deleteError && <div className="mt-4 alert-error" role="alert">{deleteError}</div>}
      {successMessage && <div className="mt-4 alert-success" role="status">{successMessage}</div>}

      {formVisible && (
        <form onSubmit={handleSubmit} className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {editingId ? "Edit location" : "Add location"}
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-[var(--muted)]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-[var(--muted)]">Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saveLoading} className="btn-primary">
                {saveLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" aria-hidden /> Saving…
                  </span>
                ) : (
                  "Save"
                )}
              </button>
              <button type="button" onClick={cancelForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card mt-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-[var(--muted)]">
            <div className="spinner" aria-hidden />
            <span className="text-sm">Loading locations…</span>
          </div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted)]">No locations yet. Add one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Zones</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Assets</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--border)]/20">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{w.name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{w.code ?? "—"}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--foreground)]">{w.zonesCount ?? 0}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--foreground)]">{w.assetsCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        className="mr-3 text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(w)}
                        className="text-sm font-medium text-[var(--error)] hover:underline"
                      >
                        Delete
                      </button>
                    </td>
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
