"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";

type DashboardCounts = {
  total: number;
  byStatus: { in_use: number; idle: number; damaged: number; lost: number };
  byOwner: { companyOwned: number; clientOwned: number };
};

const STATUS_LABELS: Record<string, string> = {
  in_use: "In use",
  idle: "Idle",
  damaged: "Damaged",
  lost: "Lost",
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const accessDenied = searchParams.get("message") === "access_denied";
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      apiFetch("/api/dashboard")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then(setCounts)
        .catch(() => setError("Failed to load dashboard"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const c = counts!;
  const needsAttention = (c.byStatus.damaged ?? 0) + (c.byStatus.lost ?? 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      {accessDenied && (
        <p className="mt-2 text-sm text-amber-700">
          You don&apos;t have access to that page.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-500">Total assets</h2>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{c.total}</p>
          <Link
            href="/assets"
            className="mt-2 block text-sm text-blue-600 hover:underline"
          >
            View all →
          </Link>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 sm:col-span-2">
          <h2 className="text-sm font-medium text-gray-500">By status</h2>
          <ul className="mt-2 flex flex-wrap gap-4">
            {(["in_use", "idle", "damaged", "lost"] as const).map((status) => (
              <li key={status}>
                <Link
                  href={`/assets?status=${status}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {STATUS_LABELS[status]}: {c.byStatus[status] ?? 0}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-500">By ownership</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <Link
                href="/assets?clientId=company"
                className="text-sm text-blue-600 hover:underline"
              >
                Company-owned: {c.byOwner.companyOwned ?? 0}
              </Link>
            </li>
            <li>
              <Link
                href="/assets?clientId=client_owned"
                className="text-sm text-blue-600 hover:underline"
              >
                Client-owned: {c.byOwner.clientOwned ?? 0}
              </Link>
            </li>
          </ul>
        </div>

        {needsAttention > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
            <h2 className="text-sm font-medium text-amber-800">Needs attention</h2>
            <p className="mt-1 text-sm text-amber-700">
              {c.byStatus.damaged ?? 0} damaged, {c.byStatus.lost ?? 0} lost
            </p>
            <Link
              href="/assets?status=damaged"
              className="mt-2 mr-4 inline-block text-sm text-blue-600 hover:underline"
            >
              View damaged →
            </Link>
            <Link
              href="/assets?status=lost"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              View lost →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
