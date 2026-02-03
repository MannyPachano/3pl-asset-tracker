"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, getAuthHeaders } from "@/lib/auth-client";

type ImportError = { row: number; label_id: string; message: string };
type ImportResponse = {
  total_rows?: number;
  imported?: number;
  failed?: number;
  errors?: ImportError[];
  message?: string;
  error?: string;
};

export default function AssetsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);

    fetch("/api/assets/import", {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    })
      .then(async (r) => {
        const data: ImportResponse = await r.json().catch(() => ({}));
        if (!r.ok) {
          setResult({
            error: data.error ?? data.message ?? "Import failed",
            errors: data.errors ?? [],
            total_rows: data.total_rows,
            imported: data.imported ?? 0,
            failed: data.failed ?? 0,
          });
          return;
        }
        setResult({
          total_rows: data.total_rows,
          imported: data.imported ?? 0,
          failed: data.failed ?? 0,
          errors: data.errors ?? [],
        });
      })
      .catch(() => setResult({ error: "Network error. Please try again." }))
      .finally(() => setUploading(false));
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link
          href="/assets"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Assets
        </Link>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">Import assets from CSV</h1>
      <p className="mt-1 text-sm text-gray-600">
        Upload a CSV with columns: label_id, asset_type, status (required); client, warehouse, zone, notes (optional).
        Max 5 MB, 10,000 rows. Duplicate label IDs in the file or in the database will be reported as errors.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFileChange}
            className="mt-1 block text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {uploading ? "Importing…" : "Import"}
        </button>
      </form>

      {result && (
        <div className="mt-8">
          {result.error && (
            <p className="text-sm text-red-600">{result.error}</p>
          )}
          {result.imported != null && (
            <p className="text-sm text-gray-900">
              <strong>Imported:</strong> {result.imported} of {result.total_rows ?? "?"} rows.
              {result.failed != null && result.failed > 0 && (
                <span className="text-amber-700"> {result.failed} failed.</span>
              )}
            </p>
          )}
          {result.errors && result.errors.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-900">Errors by row</h2>
              <div className="mt-2 max-h-80 overflow-auto rounded border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="border-b border-gray-200 px-2 py-1 text-left font-medium">Row</th>
                      <th className="border-b border-gray-200 px-2 py-1 text-left font-medium">Label ID</th>
                      <th className="border-b border-gray-200 px-2 py-1 text-left font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i}>
                        <td className="border-b border-gray-100 px-2 py-1">{err.row}</td>
                        <td className="border-b border-gray-100 px-2 py-1 font-mono">{err.label_id || "—"}</td>
                        <td className="border-b border-gray-100 px-2 py-1 text-red-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result.imported != null && result.imported > 0 && (
            <p className="mt-4">
              <Link href="/assets" className="text-sm text-blue-600 hover:underline">
                View assets →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
