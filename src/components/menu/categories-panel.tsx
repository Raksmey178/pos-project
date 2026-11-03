"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { cardClass, chipOff, chipOn, smallButton } from "@/components/ui-classes";
import type { CategoryRow } from "@/server/services/menu";
import { EntityForm, type Field, type FormValues } from "./entity-form";
import type { AdminAction } from "./use-admin-action";

export function CategoriesPanel({ categories, act }: { categories: CategoryRow[]; act: AdminAction }) {
  const t = useTranslations("MenuAdmin");
  const [editingId, setEditingId] = useState<string | null>(null);

  const createFields: Field[] = [
    { key: "nameKm", label: t("nameKm"), kind: "text", required: true },
    { key: "nameEn", label: t("nameEn"), kind: "text" },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
  ];
  const editFields: Field[] = [...createFields, { key: "isActive", label: t("isActive"), kind: "checkbox" }];

  const payload = (values: FormValues) => ({
    nameKm: String(values.nameKm).trim(),
    nameEn: String(values.nameEn ?? ""),
    ...(values.sortOrder !== "" && values.sortOrder !== undefined ? { sortOrder: Number(values.sortOrder) } : {}),
  });

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <h2 className="mb-3 text-xl font-semibold">{t("addCategory")}</h2>
        <EntityForm
          fields={createFields}
          initial={{ nameKm: "", nameEn: "", sortOrder: "" }}
          submitLabel={t("add")}
          busy={act.busy !== null}
          onSubmit={(values) => act.run("category:new", () => callApi("/api/categories", "POST", payload(values)))}
        />
      </section>

      {categories.length === 0 && <p className="text-zinc-500">{t("empty")}</p>}
      <ul className="space-y-3">
        {categories.map((category) => (
          <li key={category.id} className={cardClass}>
            {editingId === category.id ? (
              <EntityForm
                fields={editFields}
                initial={{
                  nameKm: category.nameKm,
                  nameEn: category.nameEn ?? "",
                  sortOrder: String(category.sortOrder),
                  isActive: category.isActive,
                }}
                submitLabel={t("save")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  const ok = await act.run(`category:${category.id}`, () =>
                    callApi(`/api/categories/${category.id}`, "PATCH", { ...payload(values), isActive: values.isActive === true }),
                  );
                  if (ok) setEditingId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xl font-medium">{category.nameKm}</p>
                  {category.nameEn && <p className="text-base text-zinc-600 dark:text-zinc-400">{category.nameEn}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={category.isActive ? chipOn : chipOff}>{category.isActive ? t("active") : t("inactive")}</span>
                  <button type="button" className={smallButton} onClick={() => setEditingId(category.id)}>
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
