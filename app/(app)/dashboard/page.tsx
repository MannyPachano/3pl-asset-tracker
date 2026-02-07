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
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Dashboard</h1>
        <div className="mt-6 flex items-center gap-3 text-[var(--muted)]">
          <div className="spinner" aria-hidden />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Dashboard</h1>
        <div className="mt-4 alert-error" role="alert">{error}</div>
      </div>
    );
  }

  const c = counts!;
  const needsAttention = (c.byStatus.damaged ?? 0) + (c.byStatus.lost ?? 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">See how many assets you have and where they are.</p>
      {accessDenied && (
        <div className="mt-4 alert-warning" role="alert">
          You don&apos;t have access to that page.
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Total assets</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{c.total}</p>
          <Link
            href="/assets"
            className="mt-3 inline-flex items-center text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-90"
          >
            View all →
          </Link>
        </div>

        <div className="card p-5 sm:col-span-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">By status</h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {(["in_use", "idle", "damaged", "lost"] as const).map((status) => (
              <li key={status}>
                <Link
                  href={`/assets?status=${status}`}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-focus)]"
                >
                  {STATUS_LABELS[status]}: <span className="ml-1 tabular-nums font-semibold">{c.byStatus[status] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">By ownership</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href="/assets?clientId=company"
                className="text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-90"
              >
                Company-owned: <span className="tabular-nums">{c.byOwner.companyOwned ?? 0}</span>
              </Link>
            </li>
            <li>
              <Link
                href="/assets?clientId=client_owned"
                className="text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-90"
              >
                Client-owned: <span className="tabular-nums">{c.byOwner.clientOwned ?? 0}</span>
              </Link>
            </li>
          </ul>
        </div>

        {needsAttention > 0 && (
          <div className="alert-warning sm:col-span-2" role="alert">
            <h2 className="font-medium">Needs attention</h2>
            <p className="mt-1 text-sm">
              {c.byStatus.damaged ?? 0} damaged, {c.byStatus.lost ?? 0} lost
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/assets?status=damaged"
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                View damaged →
              </Link>
              <Link
                href="/assets?status=lost"
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                View lost →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
