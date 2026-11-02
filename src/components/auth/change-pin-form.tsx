"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { useErrorText } from "@/components/use-error-text";

const inputClass =
  "h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-xl tracking-widest dark:border-zinc-700 dark:bg-zinc-900";

export function ChangePinForm() {
  const t = useTranslations("ChangePin");
  const errorText = useErrorText();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setMessage(null);
    const result = await callApi("/api/auth/pin", "POST", { currentPin, newPin });
    setPending(false);

    if (result.ok) {
      setCurrentPin("");
      setNewPin("");
      setMessage({ kind: "ok", text: t("done") });
    } else {
      setMessage({ kind: "error", text: errorText(result.error, result.lockedUntil) });
    }
  }

  return (
    <section className="w-full max-w-sm text-left">
      <h2 className="mb-3 text-xl font-semibold">{t("title")}</h2>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("currentPin")}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-base text-zinc-600 dark:text-zinc-400">{t("newPin")}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
          <span className="mt-1 block text-sm text-zinc-500">{t("hint")}</span>
        </label>
        <button
          type="button"
          disabled={pending || currentPin.length < 4 || newPin.length < 4}
          onClick={() => void submit()}
          className="h-14 w-full rounded-2xl bg-zinc-900 text-lg font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t("save")}
        </button>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
