"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth-client";

const GENERIC_ERROR = "Invalid email or password.";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSuccess = searchParams.get("set") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError(GENERIC_ERROR);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? GENERIC_ERROR);
        return;
      }
      if (data.token) {
        setToken(data.token);
        router.replace("/dashboard");
        return;
      }
      setError(GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          3PL Asset Tracker
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sign in with your email.</p>
        {setSuccess && (
          <div className="mt-4 alert-success" role="status">Password set. You can sign in.</div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>
          {error ? (
            <div className="alert-error" role="alert">{error}</div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" aria-hidden /> Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <div className="spinner" aria-hidden />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
