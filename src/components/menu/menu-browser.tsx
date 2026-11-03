"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/use-error-text";
import { callApi } from "@/lib/api-client";
import { formatUsd, formatUsdDelta } from "@/lib/money";
import { cardClass, chipWarn, smallButton } from "@/components/ui-classes";
import type { OrderableMenu } from "@/server/services/menu";

export function MenuBrowser({ menu, canToggleSoldOut }: { menu: OrderableMenu; canToggleSoldOut: boolean }) {
  const t = useTranslations("Menu");
  const errorText = useErrorText();
  const router = useRouter();

  // Categories without any item are not worth showing to a waiter.
  const categories = menu.categories.filter((category) => category.items.length > 0);
  const [selectedId, setSelectedId] = useState<string | null>(categories[0]?.id ?? null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];

  async function toggleSoldOut(itemId: string, isSoldOut: boolean) {
    setBusyId(itemId);
    setError(null);
    const result = await callApi(`/api/menu-items/${itemId}/sold-out`, "PATCH", { isSoldOut });
    setBusyId(null);
    if (!result.ok) setError(errorText(result.error, result.lockedUntil));
    else router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
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

      {!selected ? (
        <p className="text-lg text-zinc-500">{t("empty")}</p>
      ) : (
        <>
          <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                role="tab"
                type="button"
                aria-selected={category.id === selected.id}
                onClick={() => setSelectedId(category.id)}
                className={`h-14 shrink-0 rounded-2xl px-5 text-lg font-medium ${
                  category.id === selected.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {category.nameKm}
              </button>
            ))}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {selected.items.map((item) => {
              const open = openItemId === item.id;
              return (
                <li key={item.id} className={`${cardClass} ${item.isSoldOut ? "opacity-60" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenItemId(open ? null : item.id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <span className="text-xl font-medium">{item.nameKm}</span>
                    <span className="shrink-0 text-xl">{formatUsd(item.priceCents)}</span>
                  </button>

                  {item.isSoldOut && <span className={`${chipWarn} mt-2 inline-block`}>{t("soldOut")}</span>}

                  {open && (
                    <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      {item.modifierGroups.length === 0 && <p className="text-zinc-500">{t("noOptions")}</p>}
                      {item.modifierGroups.map((group) => (
                        <div key={group.id}>
                          <p className="text-base font-medium">
                            {group.nameKm}{" "}
                            <span className="font-normal text-zinc-500">{t("choose", { min: group.minSelect, max: group.maxSelect })}</span>
                          </p>
                          <p className="text-base text-zinc-600 dark:text-zinc-400">
                            {group.options
                              .map((option) =>
                                option.priceDeltaCents === 0 ? option.nameKm : `${option.nameKm} (${formatUsdDelta(option.priceDeltaCents)})`,
                              )
                              .join("  ·  ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {canToggleSoldOut && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void toggleSoldOut(item.id, !item.isSoldOut)}
                      className={`${smallButton} mt-3`}
                    >
                      {item.isSoldOut ? t("markAvailable") : t("markSoldOut")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
