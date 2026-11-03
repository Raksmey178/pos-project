"use client";

import { useState } from "react";
import { inputClass, labelClass, primaryButton, smallButton } from "@/components/ui-classes";

export type Option = { value: string; label: string };

// One description per input. The form below draws them, so every admin form looks and behaves the same.
export type Field = { key: string; label: string; hint?: string } & (
  | { kind: "text"; required?: boolean; maxLength?: number }
  | { kind: "number" }
  | { kind: "money" } // typed as dollars, e.g. 3.50; the caller turns it into cents
  | { kind: "select"; options: Option[] }
  | { kind: "checkbox" }
  | { kind: "multi"; options: Option[] }
);

export type FormValue = string | boolean | string[];
export type FormValues = Record<string, FormValue>;

export function EntityForm({
  fields,
  initial,
  submitLabel,
  cancelLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  fields: Field[];
  initial: FormValues;
  submitLabel: string;
  cancelLabel?: string;
  busy: boolean;
  onSubmit: (values: FormValues) => unknown;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const set = (key: string, value: FormValue) => setValues((current) => ({ ...current, [key]: value }));

  const missingRequired = fields.some(
    (field) => field.kind === "text" && field.required && String(values[field.key] ?? "").trim() === "",
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!missingRequired && !busy) void onSubmit(values);
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {fields.map((field) => {
        const value = values[field.key];

        if (field.kind === "checkbox") {
          return (
            <label key={field.key} className="flex h-14 items-center gap-3 text-lg sm:col-span-2">
              <input type="checkbox" className="h-6 w-6" checked={value === true} onChange={(e) => set(field.key, e.target.checked)} />
              {field.label}
            </label>
          );
        }

        if (field.kind === "multi") {
          const chosen = Array.isArray(value) ? value : [];
          return (
            <fieldset key={field.key} className="sm:col-span-2">
              <legend className={labelClass}>{field.label}</legend>
              <div className="flex flex-wrap gap-2">
                {field.options.map((option) => (
                  <label key={option.value} className="flex h-12 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-base dark:border-zinc-700">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={chosen.includes(option.value)}
                      onChange={(e) =>
                        set(field.key, e.target.checked ? [...chosen, option.value] : chosen.filter((v) => v !== option.value))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        return (
          <label key={field.key} className="block">
            <span className={labelClass}>{field.label}</span>
            {field.kind === "select" ? (
              <select className={inputClass} value={String(value ?? "")} onChange={(e) => set(field.key, e.target.value)}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                type={field.kind === "number" ? "number" : "text"}
                inputMode={field.kind === "money" ? "decimal" : field.kind === "number" ? "numeric" : undefined}
                maxLength={field.kind === "text" ? (field.maxLength ?? 80) : undefined}
                autoComplete="off"
                value={String(value ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
            {field.hint && <span className="mt-1 block text-sm text-zinc-500">{field.hint}</span>}
          </label>
        );
      })}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy || missingRequired} className={`${primaryButton} flex-1`}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={smallButton}>
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
