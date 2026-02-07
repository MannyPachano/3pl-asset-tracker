"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/auth-client";

type UserItem = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [linkUserId, setLinkUserId] = useState<number | null>(null);
  const [linkModal, setLinkModal] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    apiFetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => {
        if (me?.userId != null) setCurrentUserId(me.userId);
      })
      .catch(() => {});
  }, []);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSubmitting(true);
    apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim() || undefined,
        role: inviteRole,
        password: invitePassword || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d?.error ?? "Invite failed"); });
        return r.json();
      })
      .then((data) => {
        setInviteEmail("");
        setInviteFullName("");
        setInviteRole("user");
        setInvitePassword("");
        loadUsers();
        if (data.setPasswordLink && !invitePassword) {
          setInviteSuccessLink(data.setPasswordLink);
        } else {
          setInviteOpen(false);
        }
      })
      .catch((err) => setInviteError(err instanceof Error ? err.message : "Invite failed"))
      .finally(() => setInviteSubmitting(false));
  }

  function handleGetSetPasswordLink(user: UserItem) {
    setLinkUserId(user.id);
    apiFetch(`/api/users/${user.id}/set-password-link`)
      .then((r) => r.json())
      .then((data) => {
        if (data.setPasswordLink) setLinkModal(data.setPasswordLink);
        else setLinkUserId(null);
      })
      .catch(() => setLinkUserId(null));
  }

  function handleDeactivate(user: UserItem) {
    if (!user.isActive) return;
    if (user.id === currentUserId) return;
    if (!confirm(`Deactivate ${user.email}? They will no longer be able to sign in.`)) return;
    setDeactivatingId(user.id);
    apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d?.error ?? "Failed"); });
        loadUsers();
      })
      .catch(() => setError("Failed to deactivate user"))
      .finally(() => setDeactivatingId(null));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <>
      <h2 className="text-lg font-medium text-gray-900">Users</h2>
      <p className="mt-1 text-sm text-gray-600">Manage organization users. Deactivated users cannot sign in.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-between">
        <span />
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="btn-primary"
        >
          Invite user
        </button>
      </div>

      <table className="mt-4 w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Email</th>
            <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Name</th>
            <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Role</th>
            <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Status</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Actions</th>
              <th className="border border-gray-200 px-2 py-1 text-left text-sm font-medium">Set password</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border border-gray-200 px-2 py-1 text-sm">{u.email}</td>
              <td className="border border-gray-200 px-2 py-1 text-sm">{u.fullName ?? "—"}</td>
              <td className="border border-gray-200 px-2 py-1 text-sm capitalize">{u.role}</td>
              <td className="border border-gray-200 px-2 py-1 text-sm">
                {u.isActive ? "Active" : "Deactivated"}
              </td>
              <td className="border border-gray-200 px-2 py-1">
                {u.isActive && currentUserId != null && u.id !== currentUserId && (
                  <button
                    type="button"
                    disabled={deactivatingId === u.id}
                    onClick={() => handleDeactivate(u)}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deactivatingId === u.id ? "Deactivating…" : "Deactivate"}
                  </button>
                )}
                {currentUserId != null && u.id === currentUserId && (
                  <span className="text-sm text-gray-400">(you)</span>
                )}
              </td>
              <td className="border border-gray-200 px-2 py-1">
                <button
                  type="button"
                  disabled={linkUserId === u.id}
                  onClick={() => handleGetSetPasswordLink(u)}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  {linkUserId === u.id ? "…" : "Get set-password link"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {linkModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Set-password link</h3>
            <p className="mt-2 text-sm text-gray-600">Send this link to the user so they can set or reset their password.</p>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                readOnly
                value={linkModal}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(linkModal)}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setLinkModal(null); setLinkUserId(null); }}
              className="mt-4 text-sm text-gray-600 hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Invite user</h3>
            {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Full name (optional)</label>
                <input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Initial password (optional)</label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  minLength={6}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <p className="mt-0.5 text-xs text-gray-500">Leave blank to generate a set-password link to send to the user. Otherwise at least 6 characters.</p>
              </div>
              {inviteSuccessLink ? (
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-800">User created. Send them this link to set their password:</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteSuccessLink}
                      className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteSuccessLink);
                      }}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteOpen(false);
                      setInviteError("");
                      setInviteSuccessLink(null);
                    }}
                    className="mt-2 text-sm text-green-700 hover:underline"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="btn-primary disabled:opacity-50"
                  >
                    {inviteSubmitting ? "Creating…" : "Create user"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteOpen(false);
                      setInviteError("");
                    }}
                    className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}