"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

export default function OrganizationSettingsPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/api/organization")
      .then((r) => r.json())
      .then((data) => {
        if (data.name != null) setName(data.name);
      })
      .catch(() => setError("Failed to load organization"))
      .finally(() => setLoading(false));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    apiFetch("/api/organization", {
      method: "PUT",
      body: JSON.stringify({ name: name.trim() }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d?.error ?? "Save failed"); });
        setSuccess(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Save failed"))
      .finally(() => setSaving(false));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <>
      <h2 className="text-lg font-medium text-gray-900">Organization</h2>
      <p className="mt-1 text-sm text-gray-600">Update your organization name.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">Saved.</p>}
      <form onSubmit={handleSubmit} className="mt-4 max-w-md">
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="btn-primary mt-4"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </>
  );
}
