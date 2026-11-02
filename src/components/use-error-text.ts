"use client";

import { useTranslations } from "next-intl";
import { formatClock } from "@/lib/api-client";
import type { ErrorCode } from "@/lib/error-codes";

/** Turns an API error code into Khmer text. */
export function useErrorText() {
  const t = useTranslations("Errors");
  return (code: ErrorCode, lockedUntil?: string): string =>
    code === "ACCOUNT_LOCKED"
      ? t("ACCOUNT_LOCKED", { time: lockedUntil ? formatClock(lockedUntil) : "--:--" })
      : t(code);
}
