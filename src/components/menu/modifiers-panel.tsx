"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { formatUsd, formatUsdDelta, parseUsdToCents } from "@/lib/money";
import { cardClass, chipOff, chipOn, smallButton } from "@/components/ui-classes";
import type { GroupRow, OptionRow } from "@/server/services/menu";
import { EntityForm, type Field, type FormValues } from "./entity-form";
import type { AdminAction } from "./use-admin-action";

export function ModifiersPanel({ groups, act }: { groups: GroupRow[]; act: AdminAction }) {
  const t = useTranslations("MenuAdmin");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null);

  const groupFields: Field[] = [
    { key: "nameKm", label: t("nameKm"), kind: "text", required: true },
    { key: "nameEn", label: t("nameEn"), kind: "text" },
    { key: "minSelect", label: t("minSelect"), kind: "number" },
    { key: "maxSelect", label: t("maxSelect"), kind: "number" },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
  ];
  const optionFields: Field[] = [
    { key: "nameKm", label: t("nameKm"), kind: "text", required: true },
    { key: "nameEn", label: t("nameEn"), kind: "text" },
    { key: "price", label: t("priceDelta"), kind: "money", hint: "0.50  /  -0.50" },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
  ];

  const sortOrderPart = (values: FormValues) =>
    values.sortOrder !== "" && values.sortOrder !== undefined ? { sortOrder: Number(values.sortOrder) } : {};

  const groupPayload = (values: FormValues) => ({
    nameKm: String(values.nameKm).trim(),
    nameEn: String(values.nameEn ?? ""),
    minSelect: Number(values.minSelect),
    maxSelect: Number(values.maxSelect),
    ...sortOrderPart(values),
  });

  /** Returns the option payload, or null (and shows a message) when the price text is not a valid amount. */
  const optionPayload = (values: FormValues) => {
    const priceText = String(values.price ?? "").trim();
    const cents = priceText === "" ? 0 : parseUsdToCents(priceText, { allowNegative: true });
    if (cents === null) {
      act.setError(t("invalidPrice"));
      return null;
    }
    return {
      nameKm: String(values.nameKm).trim(),
      nameEn: String(values.nameEn ?? ""),
      priceDeltaCents: cents,
      ...sortOrderPart(values),
    };
  };

  const priceText = (option: OptionRow) =>
    option.priceDeltaCents === 0 ? "" : formatUsdDelta(option.priceDeltaCents);

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <h2 className="mb-3 text-xl font-semibold">{t("addGroup")}</h2>
        <EntityForm
          fields={groupFields}
          initial={{ nameKm: "", nameEn: "", minSelect: "0", maxSelect: "1", sortOrder: "" }}
          submitLabel={t("add")}
          busy={act.busy !== null}
          onSubmit={(values) => act.run("group:new", () => callApi("/api/modifier-groups", "POST", groupPayload(values)))}
        />
      </section>

      {groups.length === 0 && <p className="text-zinc-500">{t("empty")}</p>}

      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.id} className={cardClass}>
            {editingGroupId === group.id ? (
              <EntityForm
                fields={[...groupFields, { key: "isActive", label: t("isActive"), kind: "checkbox" }]}
                initial={{
                  nameKm: group.nameKm,
                  nameEn: group.nameEn ?? "",
                  minSelect: String(group.minSelect),
                  maxSelect: String(group.maxSelect),
                  sortOrder: String(group.sortOrder),
                  isActive: group.isActive,
                }}
                submitLabel={t("save")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setEditingGroupId(null)}
                onSubmit={async (values) => {
                  const ok = await act.run(`group:${group.id}`, () =>
                    callApi(`/api/modifier-groups/${group.id}`, "PATCH", { ...groupPayload(values), isActive: values.isActive === true }),
                  );
                  if (ok) setEditingGroupId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xl font-medium">{group.nameKm}</p>
                  <p className="text-base text-zinc-600 dark:text-zinc-400">
                    {t("range", { min: group.minSelect, max: group.maxSelect })}
                    {group.nameEn ? `  ·  ${group.nameEn}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={group.isActive ? chipOn : chipOff}>{group.isActive ? t("active") : t("inactive")}</span>
                  <button type="button" className={smallButton} onClick={() => setEditingGroupId(group.id)}>
                    {t("edit")}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="mb-2 text-base font-medium text-zinc-600 dark:text-zinc-400">{t("options")}</p>
              <ul className="space-y-2">
                {group.options.map((option) => (
                  <li key={option.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                    {editingOptionId === option.id ? (
                      <EntityForm
                        fields={[...optionFields, { key: "isActive", label: t("isActive"), kind: "checkbox" }]}
                        initial={{
                          nameKm: option.nameKm,
                          nameEn: option.nameEn ?? "",
                          price: option.priceDeltaCents === 0 ? "" : (option.priceDeltaCents < 0 ? "-" : "") + formatUsd(Math.abs(option.priceDeltaCents)).replace("$", "").replace(",", ""),
                          sortOrder: String(option.sortOrder),
                          isActive: option.isActive,
                        }}
                        submitLabel={t("save")}
                        cancelLabel={t("cancel")}
                        busy={act.busy !== null}
                        onCancel={() => setEditingOptionId(null)}
                        onSubmit={async (values) => {
                          const body = optionPayload(values);
                          if (!body) return;
                          const ok = await act.run(`option:${option.id}`, () =>
                            callApi(`/api/modifier-options/${option.id}`, "PATCH", { ...body, isActive: values.isActive === true }),
                          );
                          if (ok) setEditingOptionId(null);
                        }}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg">
                          {option.nameKm} <span className="text-zinc-600 dark:text-zinc-400">{priceText(option)}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          {!option.isActive && <span className={chipOff}>{t("inactive")}</span>}
                          <button type="button" className={smallButton} onClick={() => setEditingOptionId(option.id)}>
                            {t("edit")}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {addingOptionFor === group.id ? (
                <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                  <EntityForm
                    fields={optionFields}
                    initial={{ nameKm: "", nameEn: "", price: "", sortOrder: "" }}
                    submitLabel={t("add")}
                    cancelLabel={t("cancel")}
                    busy={act.busy !== null}
                    onCancel={() => setAddingOptionFor(null)}
                    onSubmit={async (values) => {
                      const body = optionPayload(values);
                      if (!body) return;
                      const ok = await act.run(`option:new:${group.id}`, () =>
                        callApi(`/api/modifier-groups/${group.id}/options`, "POST", body),
                      );
                      if (ok) setAddingOptionFor(null);
                    }}
                  />
                </div>
              ) : (
                <button type="button" className={`${smallButton} mt-3`} onClick={() => setAddingOptionFor(group.id)}>
                  {t("addOption")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
