"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EntityForm, type Field, type FormValues } from "@/components/menu/entity-form";
import { useErrorText } from "@/components/use-error-text";
import { cardClass, chipOn, chipWarn, primaryButton, smallButton } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { newClientId } from "@/lib/client-id";
import { formatUsd } from "@/lib/money";
import type { OrderSummary } from "@/server/services/orders";

type Mode = "none" | "takeaway" | "delivery";

export function OrdersList({ orders, canEdit }: { orders: OrderSummary[]; canEdit: boolean }) {
  const t = useTranslations("Orders");
  const errorText = useErrorText();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("none");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One id per form opening: sending the same form twice gives back the same order.
  const [clientOrderId, setClientOrderId] = useState(newClientId);

  const takeawayFields: Field[] = [
    { key: "customerName", label: t("customerName"), kind: "text" },
    { key: "customerPhone", label: t("customerPhone"), kind: "text", maxLength: 20 },
  ];
  const deliveryFields: Field[] = [
    { key: "customerName", label: t("customerName"), kind: "text", required: true },
    { key: "customerPhone", label: t("customerPhone"), kind: "text", required: true, maxLength: 20 },
    { key: "deliveryAddress", label: t("deliveryAddress"), kind: "text", required: true, maxLength: 300 },
  ];

  const optional = (values: FormValues, key: string) => {
    const value = String(values[key] ?? "").trim();
    return value === "" ? {} : { [key]: value };
  };

  async function create(type: "TAKEAWAY" | "DELIVERY", values: FormValues) {
    setPending(true);
    setError(null);
    const result = await callApi<{ order: { id: string } }>("/api/orders", "POST", {
      clientOrderId,
      type,
      ...optional(values, "customerName"),
      ...optional(values, "customerPhone"),
      ...(type === "DELIVERY" ? optional(values, "deliveryAddress") : {}),
    });
    if (result.ok) {
      setClientOrderId(newClientId());
      router.push(`/orders/${result.data.order.id}`);
      return;
    }
    setPending(false);
    setError(errorText(result.error, result.lockedUntil));
  }

  const typeLabel = { DINE_IN: t("typeDINE_IN"), TAKEAWAY: t("typeTAKEAWAY"), DELIVERY: t("typeDELIVERY") } as const;
  const statusLabel = { OPEN: t("statusOPEN"), BILL_REQUESTED: t("statusBILL_REQUESTED"), PAID: t("statusPAID"), VOIDED: t("statusVOIDED"), MERGED: t("statusMERGED") } as const;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <Link href="/" className={`${smallButton} flex items-center`}>
          {t("back")}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/tables" className={`${primaryButton} inline-flex items-center`}>
          {t("floorPlan")}
        </Link>
        {canEdit && (
          <>
            <button type="button" className={smallButton} onClick={() => { setMode(mode === "takeaway" ? "none" : "takeaway"); setError(null); }}>
              + {t("newTakeaway")}
            </button>
            <button type="button" className={smallButton} onClick={() => { setMode(mode === "delivery" ? "none" : "delivery"); setError(null); }}>
              + {t("newDelivery")}
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {mode !== "none" && (
        <section className={`${cardClass} mb-4`}>
          <EntityForm
            key={mode}
            fields={mode === "takeaway" ? takeawayFields : deliveryFields}
            initial={{ customerName: "", customerPhone: "", deliveryAddress: "" }}
            submitLabel={t("create")}
            cancelLabel={t("cancel")}
            busy={pending}
            onCancel={() => setMode("none")}
            onSubmit={(values) => create(mode === "takeaway" ? "TAKEAWAY" : "DELIVERY", values)}
          />
        </section>
      )}

      {orders.length === 0 && <p className="text-lg text-zinc-500">{t("empty")}</p>}

      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className={`${cardClass} flex flex-wrap items-center justify-between gap-3 active:bg-zinc-100 dark:active:bg-zinc-900`}>
              <div>
                <p className="text-xl font-medium">
                  {t("number", { number: order.orderNumber })}
                  {order.tableNames.length > 0 && <span className="text-zinc-600 dark:text-zinc-400"> · {t("tableNames", { names: order.tableNames.join(", ") })}</span>}
                </p>
                <p className="text-base text-zinc-600 dark:text-zinc-400">
                  {typeLabel[order.type]} · {t("itemsCount", { count: order.itemCount })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={order.status === "OPEN" ? chipOn : chipWarn}>{statusLabel[order.status]}</span>
                <span className="text-xl">{formatUsd(order.subtotalCents)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
