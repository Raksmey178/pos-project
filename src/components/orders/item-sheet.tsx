"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/use-error-text";
import { inputClass, labelClass, primaryButton, smallButton } from "@/components/ui-classes";
import { callApi } from "@/lib/api-client";
import { newClientId } from "@/lib/client-id";
import { calculateLineTotalCents, formatUsd, formatUsdDelta } from "@/lib/money";
import { checkModifierSelection } from "@/lib/order-modifiers";
import type { OrderableMenu } from "@/server/services/menu";

export type PickableItem = OrderableMenu["categories"][number]["items"][number];

/** The window for adding one item: options, quantity and a note. */
export function ItemSheet({
  item,
  orderId,
  onClose,
  onAdded,
}: {
  item: PickableItem;
  orderId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("Orders");
  const errorText = useErrorText();
  // Made once, BEFORE sending: if the network drops and "Add" is tapped again, the item is never added twice.
  const [clientItemId] = useState(newClientId);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = item.modifierGroups;
  const valid = checkModifierSelection(
    groups.map((group) => ({
      id: group.id,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      optionIds: group.options.map((option) => option.id),
    })),
    selected,
  ).ok;

  // The price shown here is only a preview: the server works out the real one.
  let total: string;
  try {
    const deltas = groups.flatMap((group) => group.options.filter((o) => selected.includes(o.id)).map((o) => o.priceDeltaCents));
    total = formatUsd(calculateLineTotalCents({ unitPriceCents: item.priceCents, modifierDeltasCents: deltas, quantity }));
  } catch {
    total = "—";
  }

  function toggle(group: PickableItem["modifierGroups"][number], optionId: string) {
    setSelected((current) => {
      const inGroup = group.options.map((option) => option.id);
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      if (group.maxSelect === 1) return [...current.filter((id) => !inGroup.includes(id)), optionId]; // pick one: replaces
      const count = current.filter((id) => inGroup.includes(id)).length;
      return count >= group.maxSelect ? current : [...current, optionId];
    });
  }

  async function add() {
    setPending(true);
    setError(null);
    const result = await callApi(`/api/orders/${orderId}/items`, "POST", {
      clientItemId,
      menuItemId: item.id,
      quantity,
      note: note.trim(),
      optionIds: selected,
    });
    if (result.ok) {
      onAdded();
      return;
    }
    setPending(false);
    setError(errorText(result.error, result.lockedUntil));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.nameKm}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl dark:bg-zinc-950"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{item.nameKm}</h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">{formatUsd(item.priceCents)}</p>
          </div>
          <button type="button" onClick={onClose} className={smallButton} aria-label={t("close")}>
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <fieldset key={group.id}>
              <legend className="mb-2 text-lg font-medium">
                {group.nameKm} <span className="text-base font-normal text-zinc-500">{t("choose", { min: group.minSelect, max: group.maxSelect })}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const on = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(group, option.id)}
                      className={`min-h-14 rounded-2xl border-2 px-4 text-lg ${
                        on
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {option.nameKm}
                      {option.priceDeltaCents !== 0 && <span className="ml-2 text-base opacity-80">{formatUsdDelta(option.priceDeltaCents)}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div>
            <span className={labelClass}>{t("quantity")}</span>
            <div className="flex items-center gap-3">
              <button type="button" className={`${smallButton} w-14 text-2xl`} disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="w-12 text-center text-2xl font-semibold">{quantity}</span>
              <button type="button" className={`${smallButton} w-14 text-2xl`} disabled={quantity >= 99} onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
                +
              </button>
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>{t("note")}</span>
            <input className={inputClass} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-lg text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}

          <button type="button" disabled={!valid || pending} onClick={() => void add()} className={`${primaryButton} w-full`}>
            {t("add")} · {total}
          </button>
        </div>
      </div>
    </div>
  );
}
