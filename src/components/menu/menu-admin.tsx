"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { smallButton } from "@/components/ui-classes";
import type { MenuAdminData } from "@/server/services/menu";
import { CategoriesPanel } from "./categories-panel";
import { ItemsPanel } from "./items-panel";
import { ModifiersPanel } from "./modifiers-panel";
import { StationsPanel } from "./stations-panel";
import { useAdminAction } from "./use-admin-action";

type Tab = "items" | "categories" | "modifiers" | "stations";

export function MenuAdmin({ data }: { data: MenuAdminData }) {
  const t = useTranslations("MenuAdmin");
  const act = useAdminAction();
  const [tab, setTab] = useState<Tab>("items");

  const tabs: { id: Tab; label: string }[] = [
    { id: "items", label: t("tabItems") },
    { id: "categories", label: t("tabCategories") },
    { id: "modifiers", label: t("tabModifiers") },
    { id: "stations", label: t("tabStations") },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            aria-selected={tab === entry.id}
            onClick={() => {
              setTab(entry.id);
              act.setError(null);
            }}
            className={`h-12 rounded-xl px-4 text-lg font-medium ${
              tab === entry.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {act.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {act.error}
        </p>
      )}

      {tab === "items" && (
        <ItemsPanel items={data.items} categories={data.categories} stations={data.stations} groups={data.groups} act={act} />
      )}
      {tab === "categories" && <CategoriesPanel categories={data.categories} act={act} />}
      {tab === "modifiers" && <ModifiersPanel groups={data.groups} act={act} />}
      {tab === "stations" && <StationsPanel stations={data.stations} act={act} />}
    </main>
  );
}
