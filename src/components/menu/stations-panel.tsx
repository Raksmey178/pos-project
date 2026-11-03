"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import { cardClass, chipOff, chipOn, smallButton } from "@/components/ui-classes";
import type { StationRow } from "@/server/services/menu";
import { EntityForm, type Field, type FormValues } from "./entity-form";
import type { AdminAction } from "./use-admin-action";

export function StationsPanel({ stations, act }: { stations: StationRow[]; act: AdminAction }) {
  const t = useTranslations("MenuAdmin");
  const [editingId, setEditingId] = useState<string | null>(null);

  const createFields: Field[] = [
    { key: "name", label: t("name"), kind: "text", required: true },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
  ];
  const editFields: Field[] = [...createFields, { key: "isActive", label: t("isActive"), kind: "checkbox" }];

  const payload = (values: FormValues) => ({
    name: String(values.name).trim(),
    ...(values.sortOrder !== "" && values.sortOrder !== undefined ? { sortOrder: Number(values.sortOrder) } : {}),
  });

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <h2 className="mb-3 text-xl font-semibold">{t("addStation")}</h2>
        <EntityForm
          fields={createFields}
          initial={{ name: "", sortOrder: "" }}
          submitLabel={t("add")}
          busy={act.busy !== null}
          onSubmit={(values) => act.run("station:new", () => callApi("/api/stations", "POST", payload(values)))}
        />
      </section>

      {stations.length === 0 && <p className="text-zinc-500">{t("empty")}</p>}
      <ul className="space-y-3">
        {stations.map((station) => (
          <li key={station.id} className={cardClass}>
            {editingId === station.id ? (
              <EntityForm
                fields={editFields}
                initial={{ name: station.name, sortOrder: String(station.sortOrder), isActive: station.isActive }}
                submitLabel={t("save")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  const ok = await act.run(`station:${station.id}`, () =>
                    callApi(`/api/stations/${station.id}`, "PATCH", { ...payload(values), isActive: values.isActive === true }),
                  );
                  if (ok) setEditingId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-medium">{station.name}</p>
                <div className="flex items-center gap-2">
                  <span className={station.isActive ? chipOn : chipOff}>{station.isActive ? t("active") : t("inactive")}</span>
                  <button type="button" className={smallButton} onClick={() => setEditingId(station.id)}>
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
