"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAdminAction } from "@/components/use-admin-action";
import { useErrorText } from "@/components/use-error-text";
import { cardClass, chipOff, chipOn, smallButton } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { clampPosition, overlapsAny } from "@/lib/floor-plan";
import type { TableRow, TablesAdminData } from "@/server/services/tables";
import { EntityForm, type Field, type FormValues } from "@/components/menu/entity-form";
import { FloorPlanCanvas } from "./floor-plan-canvas";


const toRect = (table: TableRow) => ({ x: table.gridX, y: table.gridY, w: table.width, h: table.height });

export function TablesAdmin({ data }: { data: TablesAdminData }) {
  const t = useTranslations("TablesAdmin");
  const tTables = useTranslations("Tables");
  const errorText = useErrorText();
  const act = useAdminAction();

  const [zoneId, setZoneId] = useState<string | null>(data.zones[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "addZone" | "editZone" | "addTable">("none");

  const zone = data.zones.find((entry) => entry.id === zoneId) ?? data.zones[0];
  const zoneTables = data.tables.filter((table) => table.zoneId === zone?.id);
  const activeTables = zoneTables.filter((table) => table.isActive);
  const inactiveTables = zoneTables.filter((table) => !table.isActive);
  const selected = zoneTables.find((table) => table.id === selectedId) ?? null;

  const zoneFields: Field[] = [
    { key: "name", label: t("zoneName"), kind: "text", required: true, maxLength: 40 },
    { key: "sortOrder", label: t("sortOrder"), kind: "number" },
  ];
  const tableFields: Field[] = [
    { key: "name", label: t("tableName"), kind: "text", required: true, maxLength: 20 },
    { key: "capacity", label: t("capacity"), kind: "number" },
    { key: "shape", label: t("shape"), kind: "select", options: [{ value: "RECT", label: t("shapeRect") }, { value: "ROUND", label: t("shapeRound") }] },
    { key: "width", label: t("width"), kind: "number" },
    { key: "height", label: t("height"), kind: "number" },
  ];

  const sortOrderPart = (values: FormValues) =>
    values.sortOrder !== "" && values.sortOrder !== undefined ? { sortOrder: Number(values.sortOrder) } : {};
  const tablePayload = (values: FormValues) => ({
    name: String(values.name).trim(),
    capacity: Number(values.capacity),
    shape: String(values.shape),
    width: Number(values.width),
    height: Number(values.height),
  });

  async function moveTo(table: TableRow, x: number, y: number) {
    if (x === table.gridX && y === table.gridY) return;
    const others = activeTables.filter((other) => other.id !== table.id).map(toRect);
    if (overlapsAny({ x, y, w: table.width, h: table.height }, others)) {
      act.setError(errorText("TABLE_OVERLAP"));
      return;
    }
    await act.run(`move:${table.id}`, () => callApi(`/api/tables/${table.id}`, "PATCH", { gridX: x, gridY: y }));
  }

  function nudge(table: TableRow, dx: number, dy: number) {
    const next = clampPosition(table.gridX + dx, table.gridY + dy, table.width, table.height);
    return moveTo(table, next.x, next.y);
  }

  if (!zone && mode !== "addZone") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <h1 className="mb-4 text-3xl font-semibold">{t("title")}</h1>
        <p className="mb-4 text-lg text-zinc-600 dark:text-zinc-400">{t("noZones")}</p>
        <button type="button" className={smallButton} onClick={() => setMode("addZone")}>
          {t("addZone")}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      {act.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {act.error}
        </p>
      )}

      {/* ----- zones ----- */}
      <div role="tablist" className="mb-3 flex flex-wrap items-center gap-2">
        {data.zones.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            aria-selected={entry.id === zone?.id}
            onClick={() => {
              setZoneId(entry.id);
              setSelectedId(null);
              setMode("none");
              act.setError(null);
            }}
            className={`h-12 rounded-xl px-4 text-lg font-medium ${
              entry.id === zone?.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
            } ${entry.isActive ? "" : "opacity-50"}`}
          >
            {entry.name}
          </button>
        ))}
        <button type="button" className={smallButton} onClick={() => setMode(mode === "addZone" ? "none" : "addZone")}>
          + {t("addZone")}
        </button>
      </div>

      {mode === "addZone" && (
        <section className={`${cardClass} mb-4`}>
          <EntityForm
            fields={zoneFields}
            initial={{ name: "", sortOrder: "" }}
            submitLabel={t("add")}
            cancelLabel={t("cancel")}
            busy={act.busy !== null}
            onCancel={() => setMode("none")}
            onSubmit={async (values) => {
              let createdId: string | undefined;
              const ok = await act.run("zone:new", async () => {
                const result = await callApi<{ zone: { id: string } }>("/api/zones", "POST", { name: String(values.name).trim(), ...sortOrderPart(values) });
                if (result.ok) createdId = result.data.zone.id;
                return result;
              });
              if (ok && createdId) {
                setZoneId(createdId);
                setSelectedId(null);
                setMode("none");
              }
            }}
          />
        </section>
      )}

      {zone && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={zone.isActive ? chipOn : chipOff}>{zone.isActive ? t("active") : t("inactive")}</span>
            <button type="button" className={smallButton} onClick={() => setMode(mode === "editZone" ? "none" : "editZone")}>
              {t("editZone")}
            </button>
            {zone.isActive && (
              <button type="button" className={smallButton} onClick={() => setMode(mode === "addTable" ? "none" : "addTable")}>
                + {t("addTable")}
              </button>
            )}
          </div>

          {mode === "editZone" && (
            <section className={`${cardClass} mb-4`}>
              <EntityForm
                key={`${zone.id}:${zone.name}:${zone.sortOrder}:${zone.isActive}`}
                fields={[...zoneFields, { key: "isActive", label: t("isActive"), kind: "checkbox" }]}
                initial={{ name: zone.name, sortOrder: String(zone.sortOrder), isActive: zone.isActive }}
                submitLabel={t("save")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setMode("none")}
                onSubmit={async (values) => {
                  const ok = await act.run(`zone:${zone.id}`, () =>
                    callApi(`/api/zones/${zone.id}`, "PATCH", { name: String(values.name).trim(), ...sortOrderPart(values), isActive: values.isActive === true }),
                  );
                  if (ok) setMode("none");
                }}
              />
            </section>
          )}

          {mode === "addTable" && (
            <section className={`${cardClass} mb-4`}>
              <EntityForm
                fields={tableFields}
                initial={{ name: "", capacity: "4", shape: "RECT", width: "2", height: "2" }}
                submitLabel={t("add")}
                cancelLabel={t("cancel")}
                busy={act.busy !== null}
                onCancel={() => setMode("none")}
                onSubmit={async (values) => {
                  let createdId: string | undefined;
                  const ok = await act.run("table:new", async () => {
                    const result = await callApi<{ table: { id: string } }>("/api/tables", "POST", { zoneId: zone.id, ...tablePayload(values) });
                    if (result.ok) createdId = result.data.table.id;
                    return result;
                  });
                  if (ok) {
                    setSelectedId(createdId ?? null);
                    setMode("none");
                  }
                }}
              />
            </section>
          )}

          {/* ----- floor plan editor ----- */}
          <p className="mb-2 text-base text-zinc-600 dark:text-zinc-400">{t("dragHint")}</p>
          <FloorPlanCanvas
            tables={activeTables}
            editable
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, x, y) => {
              const table = activeTables.find((entry) => entry.id === id);
              return table ? moveTo(table, x, y) : undefined;
            }}
            seatsLabel={(count) => tTables("seats", { count })}
          />
          {activeTables.length === 0 && <p className="mt-3 text-zinc-500">{t("empty")}</p>}

          {/* ----- selected table ----- */}
          {selected && (
            <section className={`${cardClass} mt-4`}>
              <h2 className="mb-3 text-xl font-semibold">
                {t("selected")}: {selected.name}
              </h2>

              {selected.isActive && (
                <div className="mb-4 grid max-w-xs grid-cols-3 gap-2">
                  <span />
                  <button type="button" disabled={act.busy !== null} aria-label={t("moveUp")} className={smallButton} onClick={() => void nudge(selected, 0, -1)}>
                    ↑
                  </button>
                  <span />
                  <button type="button" disabled={act.busy !== null} aria-label={t("moveLeft")} className={smallButton} onClick={() => void nudge(selected, -1, 0)}>
                    ←
                  </button>
                  <button type="button" disabled={act.busy !== null} aria-label={t("moveDown")} className={smallButton} onClick={() => void nudge(selected, 0, 1)}>
                    ↓
                  </button>
                  <button type="button" disabled={act.busy !== null} aria-label={t("moveRight")} className={smallButton} onClick={() => void nudge(selected, 1, 0)}>
                    →
                  </button>
                </div>
              )}

              <EntityForm
                key={`${selected.id}:${selected.name}:${selected.capacity}:${selected.shape}:${selected.width}:${selected.height}:${selected.isActive}:${selected.zoneId}`}
                fields={[
                  ...tableFields,
                  { key: "zoneId", label: t("zone"), kind: "select", options: data.zones.map((entry) => ({ value: entry.id, label: entry.name })) },
                  { key: "isActive", label: t("isActive"), kind: "checkbox" },
                ]}
                initial={{
                  name: selected.name,
                  capacity: String(selected.capacity),
                  shape: selected.shape,
                  width: String(selected.width),
                  height: String(selected.height),
                  zoneId: selected.zoneId,
                  isActive: selected.isActive,
                }}
                submitLabel={t("save")}
                busy={act.busy !== null}
                onSubmit={async (values) => {
                  const movedZone = String(values.zoneId) !== selected.zoneId;
                  const ok = await act.run(`table:${selected.id}`, () =>
                    callApi(`/api/tables/${selected.id}`, "PATCH", {
                      ...tablePayload(values),
                      zoneId: String(values.zoneId),
                      isActive: values.isActive === true,
                    }),
                  );
                  if (ok && movedZone) {
                    setZoneId(String(values.zoneId));
                  }
                }}
              />
            </section>
          )}

          {/* ----- switched-off tables ----- */}
          {inactiveTables.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">{t("inactiveTables")}</h2>
              <ul className="space-y-2">
                {inactiveTables.map((table) => (
                  <li key={table.id} className={`${cardClass} flex items-center justify-between gap-2`}>
                    <span className="text-lg">{table.name}</span>
                    <button type="button" className={smallButton} onClick={() => setSelectedId(table.id)}>
                      {t("edit")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
