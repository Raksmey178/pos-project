"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { callApi } from "@/lib/api-client";
import type { KitchenTicketView } from "@/server/services/kitchen";

type Ticket = KitchenTicketView & { sentByName: string };

/**
 * A kitchen ticket laid out for an 80mm receipt printer: black on white, big type.
 * It is drawn as normal text, so the browser prints Khmer with the right font and shaping.
 */
export function TicketPrint({ ticket }: { ticket: Ticket }) {
  const t = useTranslations("Kitchen");
  const [printCount, setPrintCount] = useState(ticket.printCount);
  const [pending, setPending] = useState(false);

  const typeLabel = { DINE_IN: t("typeDINE_IN"), TAKEAWAY: t("typeTAKEAWAY"), DELIVERY: t("typeDELIVERY") } as const;
  const time = new Date(ticket.sentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  async function print() {
    setPending(true);
    const result = await callApi<{ printCount: number }>(`/api/kitchen/tickets/${ticket.id}/print`, "POST");
    if (result.ok) setPrintCount(result.data.printCount); // every print and reprint is counted
    setPending(false);
    window.print();
  }

  return (
    <main className="mx-auto w-full max-w-sm p-4 print:max-w-none print:p-0">
      <style>{`@page { size: 80mm auto; margin: 3mm; } @media print { html, body { background: #fff !important; color: #000 !important; } }`}</style>

      <div className="mb-4 flex items-center gap-3 print:hidden">
        <button
          type="button"
          disabled={pending}
          onClick={() => void print()}
          className="h-14 rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t("print")}
        </button>
        <span className="text-base text-zinc-600 dark:text-zinc-400">{t("printedTimes", { count: printCount })}</span>
      </div>

      <article className="bg-white p-3 text-black print:p-0">
        <h1 className="text-center text-3xl font-bold">{ticket.stationName}</h1>
        <p className="text-center text-xl font-semibold">{t("ticket", { number: ticket.ticketNumber })}</p>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-2xl font-bold">{t("order", { number: ticket.orderNumber })}</p>
        <p className="text-xl">
          {ticket.tableNames.length > 0 && `${t("tableNames", { names: ticket.tableNames.join(", ") })} · `}
          {typeLabel[ticket.orderType]}
        </p>
        <p className="text-lg">
          {time} · {ticket.sentByName}
        </p>
        <hr className="my-2 border-dashed border-black" />
        <ul className="space-y-3">
          {ticket.items.map((item) => (
            <li key={item.id}>
              <p className="text-2xl font-bold">
                {item.quantity} × {item.nameKm}
              </p>
              {item.modifiers.map((modifier, index) => (
                <p key={index} className="pl-4 text-xl">
                  + {modifier.groupNameKm}: {modifier.nameKm}
                </p>
              ))}
              {item.note && <p className="pl-4 text-xl font-bold">** {item.note} **</p>}
            </li>
          ))}
        </ul>
        <hr className="my-2 border-dashed border-black" />
      </article>
    </main>
  );
}
