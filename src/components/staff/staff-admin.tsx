"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/use-error-text";
import { callApi, type ApiResult } from "@/lib/api-client";
import { canManageRole, ROLES, type Role } from "@/lib/roles";
import type { StaffRow } from "@/server/services/staff";

const inputClass =
  "h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-xl dark:border-zinc-700 dark:bg-zinc-900";
const smallButton =
  "h-12 rounded-xl border border-zinc-300 px-4 text-base font-medium active:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:active:bg-zinc-800";

export function StaffAdmin({ actor, staff }: { actor: { id: string; role: Role }; staff: StaffRow[] }) {
  const t = useTranslations("Staff");
  const tRoles = useTranslations("Roles");
  const errorText = useErrorText();
  const router = useRouter();

  const manageableRoles = ROLES.filter((role) => canManageRole(actor.role, role));

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>(manageableRoles[0] ?? "WAITER");
  const [newPin, setNewPin] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");

  // Runs one action, shows the error (if any) and reloads the list on success.
  async function run(key: string, request: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    setBusy(key);
    setError(null);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      setError(errorText(result.error, result.lockedUntil));
      return false;
    }
    router.refresh();
    return true;
  }

  async function addStaff() {
    const ok = await run("add", () => callApi("/api/staff", "POST", { name: newName, role: newRole, pin: newPin }));
    if (ok) {
      setNewName("");
      setNewPin("");
    }
  }

  async function saveResetPin(id: string) {
    const ok = await run(`pin:${id}`, () => callApi(`/api/staff/${id}/pin`, "POST", { pin: resetPin }));
    if (ok) {
      setResetFor(null);
      setResetPin("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {manageableRoles.length > 0 && (
        <section className="mb-8 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="mb-3 text-xl font-semibold">{t("add")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("name")}</span>
              <input value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("role")}</span>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className={inputClass}>
                {manageableRoles.map((role) => (
                  <option key={role} value={role}>
                    {tRoles(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("pin")}</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} tracking-widest`}
              />
              <span className="mt-1 block text-sm text-zinc-500">{t("pinHint")}</span>
            </label>
          </div>
          <button
            type="button"
            disabled={busy !== null || newName.trim() === "" || newPin.length < 4}
            onClick={() => void addStaff()}
            className="mt-4 h-14 w-full rounded-2xl bg-zinc-900 text-lg font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("add")}
          </button>
        </section>
      )}

      <ul className="space-y-3">
        {staff.map((person) => {
          const isSelf = person.id === actor.id;
          const canManage = canManageRole(actor.role, person.role);

          return (
            <li key={person.id} className="rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xl font-medium">{person.name}</p>
                  <p className="text-base text-zinc-600 dark:text-zinc-400">{tRoles(person.role)}</p>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className={`rounded-full px-3 py-1 ${person.isActive ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                    {person.isActive ? t("active") : t("inactive")}
                  </span>
                  {person.isLocked && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {t("locked")}
                    </span>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isSelf && (
                    <button type="button" disabled={busy !== null} className={smallButton} onClick={() => { setResetFor(resetFor === person.id ? null : person.id); setResetPin(""); }}>
                      {t("resetPin")}
                    </button>
                  )}
                  {person.isLocked && (
                    <button type="button" disabled={busy !== null} className={smallButton} onClick={() => void run(`unlock:${person.id}`, () => callApi(`/api/staff/${person.id}/unlock`, "POST"))}>
                      {t("unlock")}
                    </button>
                  )}
                  {!isSelf && (
                    <button type="button" disabled={busy !== null} className={smallButton} onClick={() => void run(`active:${person.id}`, () => callApi(`/api/staff/${person.id}`, "PATCH", { isActive: !person.isActive }))}>
                      {person.isActive ? t("deactivate") : t("activate")}
                    </button>
                  )}
                  <button type="button" disabled={busy !== null} className={smallButton} onClick={() => void run(`sessions:${person.id}`, () => callApi(`/api/staff/${person.id}/sessions/revoke`, "POST"))}>
                    {t("endSessions")}
                  </button>
                </div>
              )}

              {resetFor === person.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("pin")}</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ""))}
                      className={`${inputClass} w-44 tracking-widest`}
                    />
                  </label>
                  <button type="button" disabled={busy !== null || resetPin.length < 4} className={`${smallButton} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`} onClick={() => void saveResetPin(person.id)}>
                    {t("save")}
                  </button>
                  <button type="button" className={smallButton} onClick={() => { setResetFor(null); setResetPin(""); }}>
                    {t("cancel")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
