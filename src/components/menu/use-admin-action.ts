"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorText } from "@/components/use-error-text";
import type { ApiResult } from "@/lib/api-client";

/** Runs one admin request: shows the error (if any), and reloads the data when it worked. */
export function useAdminAction() {
  const router = useRouter();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  return { error, setError, busy, run };
}

export type AdminAction = ReturnType<typeof useAdminAction>;
