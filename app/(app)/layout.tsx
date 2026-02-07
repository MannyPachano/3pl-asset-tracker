"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken, removeToken, fetchMe, type MeResponse } from "@/lib/auth-client";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/locations/warehouses", label: "Warehouses" },
  { href: "/locations/zones", label: "Zones" },
  { href: "/asset-types", label: "Asset types" },
  { href: "/clients", label: "Clients" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/organization", label: "Settings" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    fetchMe(token)
      .then((me) => {
        if (!me) {
          removeToken();
          router.replace("/login");
          return;
        }
        setUser(me);
      })
      .catch(() => {
        removeToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    removeToken();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" aria-hidden />
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.fullName?.trim() || user.email;

  const navLinksFiltered = user.role === "admin" ? NAV_LINKS : NAV_LINKS.filter((l) => l.href !== "/settings/organization");
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      onClick={() => setMobileNavOpen(false)}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--primary-focus)] text-[var(--primary)]"
          : "text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="app-layout flex min-h-screen flex-col bg-[var(--background)]">
      <header className="app-header border-b border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link
              href="/dashboard"
              className="text-base font-semibold text-[var(--foreground)] transition-opacity hover:opacity-90"
            >
              3PL Asset Tracker
            </Link>
            <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
              {navLinksFiltered.map(({ href, label }) => navLink(href, label, isActive(href)))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--foreground)] sm:hidden"
              aria-expanded={mobileNavOpen}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                {mobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">{user.organizationName}</span>
            <span className="text-sm text-[var(--muted)]">{displayName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--border)]/50 hover:text-[var(--foreground)]"
            >
              Log out
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:hidden">
            <nav className="flex flex-col gap-0.5" aria-label="Main">
              {navLinksFiltered.map(({ href, label }) => navLink(href, label, isActive(href)))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
