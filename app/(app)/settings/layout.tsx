"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken, removeToken, fetchMe, type MeResponse } from "@/lib/auth-client";

export default function SettingsLayout({
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
        if (me.role !== "admin") {
          router.replace("/dashboard?message=access_denied");
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

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 pb-2">
        <Link
          href="/settings/organization"
          className={`text-sm ${
            pathname === "/settings/organization"
              ? "font-medium text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Organization
        </Link>
        <Link
          href="/settings/users"
          className={`text-sm ${
            pathname === "/settings/users"
              ? "font-medium text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Users
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
