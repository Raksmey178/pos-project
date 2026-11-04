"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { smallButton } from "@/components/ui-classes";
import type { FloorPlan } from "@/server/services/tables";
import { FloorPlanCanvas } from "./floor-plan-canvas";

export function FloorPlanView({ plan }: { plan: FloorPlan }) {
  const t = useTranslations("Tables");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(plan.zones[0]?.id ?? null);
  const zone = plan.zones.find((entry) => entry.id === selectedZoneId) ?? plan.zones[0];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      {!zone ? (
        <p className="text-lg text-zinc-500">{t("empty")}</p>
      ) : (
        <>
          {plan.zones.length > 1 && (
            <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {plan.zones.map((entry) => (
                <button
                  key={entry.id}
                  role="tab"
                  type="button"
                  aria-selected={entry.id === zone.id}
                  onClick={() => setSelectedZoneId(entry.id)}
                  className={`h-14 shrink-0 rounded-2xl px-5 text-lg font-medium ${
                    entry.id === zone.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          )}

          {zone.tables.length === 0 && <p className="mb-3 text-zinc-500">{t("empty")}</p>}
          <FloorPlanCanvas tables={zone.tables} seatsLabel={(count) => t("seats", { count })} />
        </>
      )}
    </main>
  );
}
