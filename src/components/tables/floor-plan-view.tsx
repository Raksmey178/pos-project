"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/use-error-text";
import { cardClass, primaryButton, smallButton, inputClass, labelClass } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { newClientId } from "@/lib/client-id";
import type { TableStatus } from "@/lib/table-status";
import type { FloorPlan, TableRow } from "@/server/services/tables";
import { FloorPlanCanvas, STATUS_CLASS } from "./floor-plan-canvas";

/** Shown under the floor plan when a free table is tapped: opens a dine-in order on it. */
function OpenTablePanel({ table }: { table: TableRow }) {
  const t = useTranslations("Tables");
  const errorText = useErrorText();
  const router = useRouter();
  // Made once, BEFORE sending. If the network drops and the button is tapped again, the
  // server recognises the same request and never opens two orders.
  const [clientOrderId] = useState(newClientId);
  const [guests, setGuests] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    setError(null);
    const result = await callApi<{ order: { id: string } }>("/api/orders", "POST", {
      clientOrderId,
      type: "DINE_IN",
      tableIds: [table.id],
      ...(guests !== "" ? { guestCount: Number(guests) } : {}),
    });
    if (result.ok) {
      router.push(`/orders/${result.data.order.id}`);
      return; // stay "pending" while the page changes
    }
    setPending(false);
    setError(errorText(result.error, result.lockedUntil));
    if (result.error === "TABLE_IN_USE") router.refresh(); // someone else just opened it: show the new status
  }

  return (
    <div className="space-y-3">
      <label className="block max-w-xs">
        <span className={labelClass}>{t("guests")}</span>
        <input
          className={inputClass}
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
        />
      </label>
      <button type="button" disabled={pending} onClick={() => void open()} className={primaryButton}>
        {t("openTable")}
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

export function FloorPlanView({ plan, canOrder }: { plan: FloorPlan; canOrder: boolean }) {
  const t = useTranslations("Tables");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(plan.zones[0]?.id ?? null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const zone = plan.zones.find((entry) => entry.id === selectedZoneId) ?? plan.zones[0];
  const selected = zone?.tables.find((table) => table.id === selectedTableId) ?? null;

  const statusLabel: Record<TableStatus, string> = {
    AVAILABLE: t("available"),
    OCCUPIED: t("occupied"),
    BILL_REQUESTED: t("billRequested"),
  };

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
                  onClick={() => {
                    setSelectedZoneId(entry.id);
                    setSelectedTableId(null);
                  }}
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

          <ul className="mb-3 flex flex-wrap gap-2 text-sm">
            {(Object.keys(statusLabel) as TableStatus[]).map((status) => (
              <li key={status} className={`rounded-full border-2 px-3 py-1 ${STATUS_CLASS[status]}`}>
                {statusLabel[status]}
              </li>
            ))}
          </ul>

          {zone.tables.length === 0 && <p className="mb-3 text-zinc-500">{t("empty")}</p>}
          <FloorPlanCanvas
            tables={zone.tables}
            selectedId={selectedTableId}
            onSelect={canOrder ? setSelectedTableId : undefined}
            seatsLabel={(count) => t("seats", { count })}
          />

          {canOrder && !selected && zone.tables.length > 0 && <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">{t("tapTable")}</p>}

          {canOrder && selected && (
            <section className={`${cardClass} mt-4`}>
              <h2 className="mb-3 text-xl font-semibold">
                {selected.name} · {statusLabel[selected.status]}
              </h2>
              {selected.orderId ? (
                <Link href={`/orders/${selected.orderId}`} className={`${primaryButton} inline-flex items-center`}>
                  {t("openOrder")}
                </Link>
              ) : (
                <OpenTablePanel key={selected.id} table={selected} />
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
