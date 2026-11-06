"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAdminAction } from "@/components/use-admin-action";
import { cardClass, chipOff, chipOn, chipWarn, inputClass, labelClass, primaryButton, smallButton } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { formatUsd } from "@/lib/money";
import type { OrderableMenu } from "@/server/services/menu";
import type { OrderSummary, OrderView } from "@/server/services/orders";
import { ItemSheet, type PickableItem } from "./item-sheet";

type FreeTable = { id: string; name: string; zoneName: string };

export function OrderScreen({
  order,
  menu,
  freeTables,
  mergeCandidates,
  canEdit,
}: {
  order: OrderView;
  menu: OrderableMenu;
  freeTables: FreeTable[];
  mergeCandidates: OrderSummary[];
  canEdit: boolean;
}) {
  const t = useTranslations("Orders");
  const router = useRouter();
  const act = useAdminAction();

  const isOpen = order.status === "OPEN" || order.status === "BILL_REQUESTED";
  const editable = canEdit && isOpen;

  const categories = menu.categories.filter((category) => category.items.length > 0);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const category = categories.find((entry) => entry.id === categoryId) ?? categories[0];
  const [picked, setPicked] = useState<PickableItem | null>(null);

  const [panel, setPanel] = useState<"none" | "transfer" | "merge">("none");
  const [fromTableId, setFromTableId] = useState(order.tables[0]?.id ?? "");
  const [toTableId, setToTableId] = useState(freeTables[0]?.id ?? "");
  const [sourceOrderId, setSourceOrderId] = useState(mergeCandidates[0]?.id ?? "");

  const typeLabel = { DINE_IN: t("typeDINE_IN"), TAKEAWAY: t("typeTAKEAWAY"), DELIVERY: t("typeDELIVERY") } as const;
  const statusLabel = { OPEN: t("statusOPEN"), BILL_REQUESTED: t("statusBILL_REQUESTED"), PAID: t("statusPAID"), VOIDED: t("statusVOIDED"), MERGED: t("statusMERGED") } as const;
  const post = (path: string, body?: unknown) => callApi(`/api/orders/${order.id}${path}`, "POST", body);

  async function cancelOrder() {
    if (await act.run("cancel", () => post("/cancel"))) router.push("/orders");
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("number", { number: order.orderNumber })}</h1>
        <Link href={order.type === "DINE_IN" ? "/tables" : "/orders"} className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={chipOff}>{typeLabel[order.type]}</span>
        <span className={order.status === "OPEN" ? chipOn : order.status === "BILL_REQUESTED" ? chipWarn : chipOff}>{statusLabel[order.status]}</span>
        {order.tables.length > 0 && <span className="text-lg">{t("tableNames", { names: order.tables.map((table) => table.name).join(", ") })}</span>}
        {order.guestCount !== null && <span className="text-lg text-zinc-600 dark:text-zinc-400">· {t("guestsCount", { count: order.guestCount })}</span>}
        <span className="text-base text-zinc-500">· {t("openedBy", { name: order.openedBy.name })}</span>
      </div>

      {(order.customerName || order.customerPhone || order.deliveryAddress) && (
        <p className="mb-4 text-lg text-zinc-700 dark:text-zinc-300">
          {[order.customerName, order.customerPhone, order.deliveryAddress].filter(Boolean).join(" · ")}
        </p>
      )}

      {!isOpen && (
        <p className="mb-4 rounded-xl bg-zinc-100 px-4 py-3 text-lg dark:bg-zinc-900">
          {t("closed")}
          {order.mergedIntoId && order.mergedIntoNumber !== null && (
            <>
              {" · "}
              <Link href={`/orders/${order.mergedIntoId}`} className="underline">
                {t("mergedInto", { number: order.mergedIntoNumber })}
              </Link>
            </>
          )}
        </p>
      )}

      {act.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {act.error}
        </p>
      )}

      {/* ----- what was ordered ----- */}
      <section className={`${cardClass} mb-4`}>
        {order.items.length === 0 ? (
          <p className="text-lg text-zinc-500">{t("noItems")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-xl">
                    <span className="font-semibold">{item.quantity} ×</span> {item.nameKm}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="text-base text-zinc-600 dark:text-zinc-400">
                      {item.modifiers.map((modifier) => `${modifier.groupNameKm}: ${modifier.nameKm}`).join(" · ")}
                    </p>
                  )}
                  {item.note && <p className="text-base italic text-zinc-600 dark:text-zinc-400">“{item.note}”</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xl">{formatUsd(item.lineTotalCents)}</span>
                  {editable && (
                    <button
                      type="button"
                      disabled={act.busy !== null}
                      className={smallButton}
                      onClick={() => void act.run(`remove:${item.id}`, () => post(`/items/${item.id}/remove`))}
                    >
                      {t("remove")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-2xl font-semibold dark:border-zinc-800">
          <span>{t("subtotal")}</span>
          <span>{formatUsd(order.subtotalCents)}</span>
        </div>
      </section>

      {/* ----- actions ----- */}
      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          {order.items.length > 0 && (
            <button
              type="button"
              disabled={act.busy !== null}
              className={order.status === "OPEN" ? primaryButton : smallButton}
              onClick={() => void act.run("bill", () => post("/bill", { requested: order.status === "OPEN" }))}
            >
              {order.status === "OPEN" ? t("requestBill") : t("reopen")}
            </button>
          )}
          {order.type === "DINE_IN" && order.tables.length > 0 && (
            <button type="button" className={smallButton} onClick={() => setPanel(panel === "transfer" ? "none" : "transfer")}>
              {t("transfer")}
            </button>
          )}
          {order.type === "DINE_IN" && (
            <button type="button" className={smallButton} onClick={() => setPanel(panel === "merge" ? "none" : "merge")}>
              {t("merge")}
            </button>
          )}
          {order.items.length === 0 && (
            <button type="button" disabled={act.busy !== null} className={smallButton} onClick={() => void cancelOrder()}>
              {t("cancelOrder")}
            </button>
          )}
        </div>
      )}

      {editable && panel === "transfer" && (
        <section className={`${cardClass} mb-4`}>
          {freeTables.length === 0 ? (
            <p className="text-lg text-zinc-500">{t("noFreeTables")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {order.tables.length > 1 && (
                <label className="block">
                  <span className={labelClass}>{t("tableNames", { names: "" })}</span>
                  <select className={inputClass} value={fromTableId} onChange={(event) => setFromTableId(event.target.value)}>
                    {order.tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className={labelClass}>{t("chooseTable")}</span>
                <select className={inputClass} value={toTableId} onChange={(event) => setToTableId(event.target.value)}>
                  {freeTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name} ({table.zoneName})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={act.busy !== null || !toTableId}
                className={`${primaryButton} sm:col-span-2`}
                onClick={async () => {
                  const ok = await act.run("transfer", () => post("/transfer", { fromTableId: fromTableId || order.tables[0].id, toTableId }));
                  if (ok) setPanel("none");
                }}
              >
                {t("confirm")}
              </button>
            </div>
          )}
        </section>
      )}

      {editable && panel === "merge" && (
        <section className={`${cardClass} mb-4`}>
          <p className="mb-3 text-base text-zinc-600 dark:text-zinc-400">{t("mergeHint")}</p>
          {mergeCandidates.length === 0 ? (
            <p className="text-lg text-zinc-500">{t("noOtherOrders")}</p>
          ) : (
            <div className="grid gap-3">
              <label className="block">
                <span className={labelClass}>{t("chooseOrder")}</span>
                <select className={inputClass} value={sourceOrderId} onChange={(event) => setSourceOrderId(event.target.value)}>
                  {mergeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {t("number", { number: candidate.orderNumber })} · {t("tableNames", { names: candidate.tableNames.join(", ") })} · {formatUsd(candidate.subtotalCents)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={act.busy !== null || !sourceOrderId}
                className={primaryButton}
                onClick={async () => {
                  const ok = await act.run("merge", () => post("/merge", { sourceOrderId }));
                  if (ok) setPanel("none");
                }}
              >
                {t("confirm")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ----- add items ----- */}
      {editable && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">{t("addItems")}</h2>
          {!category ? (
            <p className="text-lg text-zinc-500">{t("noMenu")}</p>
          ) : (
            <>
              <div role="tablist" className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {categories.map((entry) => (
                  <button
                    key={entry.id}
                    role="tab"
                    type="button"
                    aria-selected={entry.id === category.id}
                    onClick={() => setCategoryId(entry.id)}
                    className={`h-14 shrink-0 rounded-2xl px-5 text-lg font-medium ${
                      entry.id === category.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {entry.nameKm}
                  </button>
                ))}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {category.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.isSoldOut}
                      onClick={() => setPicked(item)}
                      className={`${cardClass} flex w-full items-center justify-between gap-3 text-left active:bg-zinc-100 disabled:opacity-50 dark:active:bg-zinc-900`}
                    >
                      <span className="text-xl font-medium">{item.nameKm}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {item.isSoldOut && <span className={chipWarn}>{t("soldOut")}</span>}
                        <span className="text-xl">{formatUsd(item.priceCents)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {picked && (
        <ItemSheet
          key={picked.id}
          item={picked}
          orderId={order.id}
          onClose={() => setPicked(null)}
          onAdded={() => {
            setPicked(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
