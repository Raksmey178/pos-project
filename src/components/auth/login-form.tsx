"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { useErrorText } from "@/components/use-error-text";

type StaffOption = { id: string; name: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LoginForm({ staff }: { staff: StaffOption[] }) {
  const t = useTranslations("Login");
  const errorText = useErrorText();
  const router = useRouter();

  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const addDigit = useCallback((digit: string) => setPin((p) => (p.length < 6 ? p + digit : p)), []);
  const removeDigit = useCallback(() => setPin((p) => p.slice(0, -1)), []);
  const goBack = useCallback(() => {
    setSelected(null);
    setPin("");
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!selected || pin.length < 4 || pending) return;
    setPending(true);
    setError(null);

    const result = await callApi("/api/auth/login", "POST", { staffId: selected.id, pin });
    if (result.ok) {
      router.replace("/");
      router.refresh();
      return; // stay "pending" while the page changes
    }

    setPin("");
    setPending(false);
    setError(errorText(result.error, result.lockedUntil));
    if (result.error === "ACCOUNT_LOCKED") setSelected(null);
  }, [selected, pin, pending, router, errorText]);

  // Counter PC: allow the physical keyboard too.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) addDigit(event.key);
      else if (event.key === "Backspace") removeDigit();
      else if (event.key === "Enter") void submit();
      else if (event.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, addDigit, removeDigit, submit, goBack]);

  const keyClass =
    "h-20 rounded-2xl border border-zinc-300 bg-white text-3xl font-medium text-zinc-900 active:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:active:bg-zinc-800";

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-6 text-center text-3xl font-semibold">{t("title")}</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-center text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {!selected ? (
        <div>
          <p className="mb-4 text-center text-lg text-zinc-600 dark:text-zinc-400">{t("chooseName")}</p>
          {staff.length === 0 ? (
            <p className="text-center text-lg text-zinc-500">{t("noStaff")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {staff.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    setSelected(person);
                    setError(null);
                  }}
                  className="min-h-20 rounded-2xl border border-zinc-300 bg-white px-3 text-xl font-medium active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:active:bg-zinc-800"
                >
                  {person.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-center text-2xl font-medium">{selected.name}</p>
          <p className="mb-4 text-center text-lg text-zinc-600 dark:text-zinc-400">{t("enterPin")}</p>

          <div className="mb-6 flex h-8 items-center justify-center gap-3" aria-hidden="true">
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border-2 border-zinc-500 ${i < pin.length ? "bg-zinc-900 dark:bg-zinc-100" : ""}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((digit) => (
              <button key={digit} type="button" disabled={pending} onClick={() => addDigit(digit)} className={keyClass}>
                {digit}
              </button>
            ))}
            <button type="button" disabled={pending} onClick={goBack} className={`${keyClass} text-lg`}>
              {t("back")}
            </button>
            <button type="button" disabled={pending} onClick={() => addDigit("0")} className={keyClass}>
              0
            </button>
            <button type="button" disabled={pending} onClick={removeDigit} aria-label={t("delete")} className={`${keyClass} text-lg`}>
              ⌫
            </button>
          </div>

          <button
            type="button"
            disabled={pending || pin.length < 4}
            onClick={() => void submit()}
            className="mt-4 h-20 w-full rounded-2xl bg-zinc-900 text-2xl font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("confirm")}
          </button>
        </div>
      )}
    </div>
  );
}
