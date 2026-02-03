"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

type AssetType = {
  id: number;
  name: string;
  code: string | null;
  assetsCount?: number;
};

export default function AssetTypesPage() {
  const [list, setList] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/api/asset-types")
      .then((r) => r.json())
      .then(setList)
      .catch(() => setError("Failed to load asset types"))
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

  function openEdit(a: AssetType) {
    setEditingId(a.id);
    setName(a.name);
    setCode(a.code ?? "");
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
    const url = "/api/asset-types" + (editingId ? `/${editingId}` : "");
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

  function handleDelete(a: AssetType) {
    if (!confirm("Delete this asset type?")) return;
    setDeleteError("");
    apiFetch(`/api/asset-types/${a.id}`, { method: "DELETE" })
      .then((r) => {
        if (r.status === 409) return r.json().then((d) => Promise.reject(d));
        if (!r.ok) throw new Error("Delete failed");
      })
      .then(() => load())
      .catch((d) =>
        setDeleteError(d?.error ?? "Cannot delete: assets use this type")
      );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Asset types</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}

      {formVisible && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-medium text-gray-700">
            {editingId ? "Edit asset type" : "Add asset type"}
          </h2>
          <div className="mt-2 flex flex-wrap items-end gap-4">
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
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          >
            Add asset type
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No asset types yet.</p>
      ) : (
        <table className="mt-4 w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Name</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Code</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Assets</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="border border-gray-200 px-2 py-1 text-sm">{a.name}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{a.code ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{a.assetsCount ?? 0}</td>
                <td className="border border-gray-200 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="mr-2 text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
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
