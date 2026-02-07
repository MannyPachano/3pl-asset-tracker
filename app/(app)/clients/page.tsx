"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

type Client = {
  id: number;
  name: string;
  assetsCount?: number;
};

export default function ClientsPage() {
  const [list, setList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/api/clients")
      .then((r) => r.json())
      .then(setList)
      .catch(() => setError("Failed to load clients"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      setLoading(true);
      apiFetch("/api/clients")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setList(data);
        })
        .catch(() => {
          if (!cancelled) setError("Failed to load clients");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  function openAdd() {
    setEditingId(null);
    setName("");
    setError("");
    setDeleteError("");
    setFormVisible(true);
  }

  function openEdit(c: Client) {
    setEditingId(c.id);
    setName(c.name);
    setError("");
    setDeleteError("");
    setFormVisible(true);
  }

  function cancelForm() {
    setFormVisible(false);
    setEditingId(null);
    setName("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    const body = { name: name.trim() };
    const url = "/api/clients" + (editingId ? `/${editingId}` : "");
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

  function handleDelete(c: Client) {
    if (!confirm("Delete this client?")) return;
    setDeleteError("");
    apiFetch(`/api/clients/${c.id}`, { method: "DELETE" })
      .then((r) => {
        if (r.status === 409) return r.json().then((d) => Promise.reject(d));
        if (!r.ok) throw new Error("Delete failed");
      })
      .then(() => load())
      .catch((d) =>
        setDeleteError(d?.error ?? "Cannot delete: assets are assigned to this client")
      );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}

      {formVisible && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-medium text-gray-700">
            {editingId ? "Edit client" : "Add client"}
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
            className="btn-primary"
          >
            Add client
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No clients yet.</p>
      ) : (
        <table className="mt-4 w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Name</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Assets</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="border border-gray-200 px-2 py-1 text-sm">{c.name}</td>
                <td className="border border-gray-200 px-2 py-1 text-sm">{c.assetsCount ?? 0}</td>
                <td className="border border-gray-200 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="mr-2 text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
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
