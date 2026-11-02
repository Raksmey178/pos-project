"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";

export function LogoutButton() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await callApi("/api/auth/logout", "POST");
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void logout()}
      className="h-14 rounded-2xl border border-zinc-300 px-6 text-lg font-medium active:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:active:bg-zinc-800"
    >
      {t("logout")}
    </button>
  );
}
