"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAdminAction } from "@/components/use-admin-action";
import { cardClass, chipOff, chipOn, chipWarn, smallButton } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { minutesWaiting, nextStatus, permissionForStep, previousStatus, waitLevel, type ItemStatus } from "@/lib/item-status";
import type { KitchenBoard as Board, KitchenTicketView } from "@/server/services/kitchen";

const REFRESH_MS = 5000;

const LEVEL_CLASS = {
  ok: "border-zinc-300 dark:border-zinc-700",
  slow: "border-amber-500 bg-amber-50 dark:bg-amber-950/40",
  late: "border-red-600 bg-red-50 dark:bg-red-950/40",
} as const;

export function KitchenBoard({
  board,
  canPrepare,
  canServe,
  defaultView,
}: {
  board: Board;
  canPrepare: boolean;
  canServe: boolean;
  defaultView: "active" | "ready";
}) {
  const t = useTranslations("Kitchen");
  const router = useRouter();
  const act = useAdminAction();

  const [stationId, setStationId] = useState<string>("all");
  const [view, setView] = useState<"active" | "ready">(defaultView);
  const [now, setNow] = useState(() => new Date());

  // The board refreshes itself every few seconds while the screen is visible.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const statusLabel: Record<ItemStatus, string> = {
    NEW: t("statusNEW"),
    PREPARING: t("statusPREPARING"),
    READY: t("statusREADY"),
    SERVED: t("statusSERVED"),
  };
  const stepLabel: Record<ItemStatus, string> = { NEW: t("start"), PREPARING: t("ready"), READY: t("served"), SERVED: "" };
  const batchLabel: Record<ItemStatus, string> = { NEW: t("startAll"), PREPARING: t("readyAll"), READY: t("servedAll"), SERVED: "" };
  const chipFor = { NEW: chipOff, PREPARING: chipWarn, READY: chipOn, SERVED: chipOff } as const;
  const typeLabel = { DINE_IN: t("typeDINE_IN"), TAKEAWAY: t("typeTAKEAWAY"), DELIVERY: t("typeDELIVERY") } as const;

  const may = (from: ItemStatus, to: ItemStatus) => (permissionForStep(from, to) === "kitchen:prepare" ? canPrepare : canServe);

  function change(itemIds: string[], from: ItemStatus, to: ItemStatus) {
    return act.run(`${from}>${to}:${itemIds.join()}`, async () => {
      const result = await callApi("/api/kitchen/items/status", "POST", { itemIds, from, to });
      if (!result.ok && result.error === "STATUS_CHANGED") router.refresh(); // show what the others did
      return result;
    });
  }

  const tickets = board.tickets
    .filter((ticket) => stationId === "all" || ticket.stationId === stationId)
    .map((ticket) => ({
      ticket,
      items: view === "ready" ? ticket.items.filter((item) => item.status === "READY") : ticket.items,
    }))
    .filter((entry) => entry.items.length > 0);

  function renderTicket({ ticket, items }: { ticket: KitchenTicketView; items: KitchenTicketView["items"] }) {
    const minutes = minutesWaiting(ticket.sentAt, now);
    const level = waitLevel(minutes);
    const statuses: ItemStatus[] = ["NEW", "PREPARING", "READY"];

    return (
      <li key={ticket.id} className={`rounded-2xl border-2 p-4 ${LEVEL_CLASS[level]}`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold">
              {t("ticket", { number: ticket.ticketNumber })} · {ticket.stationName}
            </p>
            <p className="text-lg">
              {t("order", { number: ticket.orderNumber })}
              {ticket.tableNames.length > 0 && ` · ${t("tableNames", { names: ticket.tableNames.join(", ") })}`}
              {` · ${typeLabel[ticket.orderType]}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-semibold ${level === "late" ? "text-red-700 dark:text-red-300" : level === "slow" ? "text-amber-700 dark:text-amber-300" : ""}`}>
              {t("minutes", { minutes })}
            </span>
            <a href={`/kitchen/tickets/${ticket.id}/print`} target="_blank" rel="noopener" className={`${smallButton} flex items-center`}>
              {t("print")}
            </a>
          </div>
        </div>

        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map((item) => {
            const next = nextStatus(item.status);
            const previous = previousStatus(item.status);
            return (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className={`text-2xl ${item.status === "SERVED" ? "text-zinc-400 line-through" : ""}`}>
                    <span className="font-semibold">{item.quantity} ×</span> {item.nameKm}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="text-lg text-zinc-600 dark:text-zinc-400">{item.modifiers.map((m) => `${m.groupNameKm}: ${m.nameKm}`).join(" · ")}</p>
                  )}
                  {item.note && <p className="text-lg font-medium text-red-700 dark:text-red-300">“{item.note}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={chipFor[item.status]}>{statusLabel[item.status]}</span>
                  {previous && may(item.status, previous) && (
                    <button type="button" disabled={act.busy !== null} aria-label={t("undo")} className={smallButton} onClick={() => void change([item.id], item.status, previous)}>
                      ↩
                    </button>
                  )}
                  {next && may(item.status, next) && (
                    <button
                      type="button"
                      disabled={act.busy !== null}
                      className="h-14 rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                      onClick={() => void change([item.id], item.status, next)}
                    >
                      {stepLabel[item.status]}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2">
          {statuses.map((from) => {
            const to = nextStatus(from)!;
            const ids = items.filter((item) => item.status === from).map((item) => item.id);
            if (ids.length < 2 || !may(from, to)) return null;
            return (
              <button key={from} type="button" disabled={act.busy !== null} className={smallButton} onClick={() => void change(ids, from, to)}>
                {batchLabel[from]}
              </button>
            );
          })}
        </div>
      </li>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap gap-2">
          {[{ id: "all", name: t("allStations") }, ...board.stations].map((station) => (
            <button
              key={station.id}
              role="tab"
              type="button"
              aria-selected={stationId === station.id}
              onClick={() => setStationId(station.id)}
              className={`h-12 rounded-xl px-4 text-lg font-medium ${
                stationId === station.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {station.name}
            </button>
          ))}
        </div>
        <span className="mx-2 hidden h-8 w-px bg-zinc-300 sm:block dark:bg-zinc-700" />
        <div role="tablist" className="flex gap-2">
          {(["active", "ready"] as const).map((entry) => (
            <button
              key={entry}
              role="tab"
              type="button"
              aria-selected={view === entry}
              onClick={() => setView(entry)}
              className={`h-12 rounded-xl px-4 text-lg font-medium ${
                view === entry ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {entry === "active" ? t("viewActive") : t("viewReady")}
            </button>
          ))}
        </div>
      </div>

      {act.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {act.error}
        </p>
      )}

      {tickets.length === 0 ? (
        <p className={`${cardClass} text-lg text-zinc-500`}>{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">{tickets.map(renderTicket)}</ul>
      )}
    </main>
  );
}
