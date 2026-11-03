"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { formatUsd, parseUsdToCents } from "@/lib/money";
import { cardClass, chipOff, chipOn, chipWarn, smallButton } from "@/components/ui-classes";
import type { CategoryRow, GroupRow, ItemRow, StationRow } from "@/server/services/menu";
import { EntityForm, type Field, type FormValues } from "./entity-form";
import type { AdminAction } from "./use-admin-action";

/** 350 -> "3.50" (what a person would type in the price box). */
const priceToInput = (cents: number) => formatUsd(cents).replace("$", "").replace(",", "");

export function ItemsPanel({
  items,
  categories,
  stations,
  groups,
  act,
}: {
  items: ItemRow[];
  categories: CategoryRow[];
  stations: StationRow[];
  groups: GroupRow[];
  act: AdminAction;
}) {
  const t = useTranslations("MenuAdmin");
  const [editingId, setEditingId] = useState<string | null>(null);

  const categoryName = new Map(categories.map((c) => [c.id, c.nameKm]));
  const stationName = new Map(stations.map((s) => [s.id, s.name]));
  const usableStations = stations.filter((s) => s.isActive);
  const ready = categories.length > 0 && usableStations.length > 0;

  const fields: Field[] = [
    { key: "nameKm", label: t("nameKm"), kind: "text", required: true },
    { key: "nameEn", label: t("nameEn"), kind: "text" },
    { key: "categoryId", label: t("category"), kind: "select", options: categories.map((c) => ({ value: c.id, label: c.nameKm })) },
    { key: "stationId", label: t("station"), kind: "select", options: stations.map((s) => ({ value: s.id, label: s.name })) },
    { key: "price", label: t("price"), kind: "money", hint: t("priceHint") },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
    { key: "modifierGroupIds", label: t("groups"), kind: "multi", options: groups.map((g) => ({ value: g.id, label: g.nameKm })) },
  ];

  /** Returns the request body, or null (and shows a message) when the price text is not a valid amount. */
  const payload = (values: FormValues) => {
    const cents = parseUsdToCents(String(values.price ?? ""));
    if (cents === null) {
      act.setError(t("invalidPrice"));
      return null;
    }
    return {
      nameKm: String(values.nameKm).trim(),
      nameEn: String(values.nameEn ?? ""),
      categoryId: String(values.categoryId),
      stationId: String(values.stationId),
      priceCents: cents,
      modifierGroupIds: Array.isArray(values.modifierGroupIds) ? values.modifierGroupIds : [],
      ...(values.sortOrder !== "" && values.sortOrder !== undefined ? { sortOrder: Number(values.sortOrder) } : {}),
    };
  };

  return (
    <div className="space-y-4">
      {!ready ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-lg text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("needSetup")}</p>
      ) : (
        <section className={cardClass}>
          <h2 className="mb-3 text-xl font-semibold">{t("addItem")}</h2>
          <EntityForm
            fields={fields}
            initial={{
              nameKm: "",
              nameEn: "",
              categoryId: categories[0].id,
              stationId: usableStations[0].id,
              price: "",
              sortOrder: "",
              modifierGroupIds: [],
            }}
            submitLabel={t("add")}
            busy={act.busy !== null}
            onSubmit={(values) => {
              const body = payload(values);
              if (!body) return;
              return act.run("item:new", () => callApi("/api/menu-items", "POST", body));
            }}
          />
        </section>
      )}

      {items.length === 0 && <p className="text-zinc-500">{t("empty")}</p>}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className={cardClass}>
            {editingId === item.id ? (
              <EntityForm
                fields={[...fields, { key: "isActive", label: t("isActive"), kind: "checkbox" }]}
                initial={{
                  nameKm: item.nameKm,
                  nameEn: item.nameEn ?? "",
                  categoryId: item.categoryId,
                  stationId: item.stationId,
                  price: priceToInput(item.priceCents),
                  sortOrder: String(item.sortOrder),
                  modifierGroupIds: item.modifierGroupIds,
                  isActive: item.isActive,
                }}
                submitLabel={t("save")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  const body = payload(values);
                  if (!body) return;
                  const ok = await act.run(`item:${item.id}`, () =>
                    callApi(`/api/menu-items/${item.id}`, "PATCH", { ...body, isActive: values.isActive === true }),
                  );
                  if (ok) setEditingId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-medium">
                    {item.nameKm} <span className="text-zinc-600 dark:text-zinc-400">{formatUsd(item.priceCents)}</span>
                  </p>
                  <p className="text-base text-zinc-600 dark:text-zinc-400">
                    {categoryName.get(item.categoryId)} · {stationName.get(item.stationId)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={item.isActive ? chipOn : chipOff}>{item.isActive ? t("active") : t("inactive")}</span>
                  {item.isSoldOut && <span className={chipWarn}>{t("soldOut")}</span>}
                  <button
                    type="button"
                    disabled={act.busy !== null}
                    className={smallButton}
                    onClick={() => void act.run(`soldout:${item.id}`, () => callApi(`/api/menu-items/${item.id}/sold-out`, "PATCH", { isSoldOut: !item.isSoldOut }))}
                  >
                    {item.isSoldOut ? t("markAvailable") : t("markSoldOut")}
                  </button>
                  <button type="button" className={smallButton} onClick={() => setEditingId(item.id)}>
                    {t("edit")}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
