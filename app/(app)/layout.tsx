"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken, removeToken, fetchMe, type MeResponse } from "@/lib/auth-client";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.fullName?.trim() || user.email;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-900 hover:text-gray-700"
            >
              3PL Asset Tracker
            </Link>
            <nav className="flex gap-4">
              <Link
                href="/dashboard"
                className={`text-sm ${
                  pathname === "/dashboard"
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/assets"
                className={`text-sm ${
                  pathname?.startsWith("/assets")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Assets
              </Link>
              <Link
                href="/locations/warehouses"
                className={`text-sm ${
                  pathname?.startsWith("/locations/warehouses")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Warehouses
              </Link>
              <Link
                href="/locations/zones"
                className={`text-sm ${
                  pathname?.startsWith("/locations/zones")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Zones
              </Link>
              <Link
                href="/asset-types"
                className={`text-sm ${
                  pathname?.startsWith("/asset-types")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Asset types
              </Link>
              <Link
                href="/clients"
                className={`text-sm ${
                  pathname?.startsWith("/clients")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Clients
              </Link>
              <Link
                href="/reports"
                className={`text-sm ${
                  pathname?.startsWith("/reports")
                    ? "font-medium text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Reports
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/settings/organization"
                  className={`text-sm ${
                    pathname?.startsWith("/settings")
                      ? "font-medium text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Settings
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.organizationName}</span>
            <span className="text-sm text-gray-500">{displayName}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
