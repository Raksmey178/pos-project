import { z } from "zod";

// strictObject: unknown fields are rejected.
const text = (max: number) => z.string().trim().min(1).max(max);
const phone = z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/);

export const createOrderSchema = z
  .strictObject({
    clientOrderId: z.uuid(),
    type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
    tableIds: z.array(z.uuid()).max(6).optional(),
    guestCount: z.number().int().min(1).max(99).optional(),
    customerName: text(80).optional(),
    customerPhone: phone.optional(),
    deliveryAddress: text(300).optional(),
  })
  .superRefine((order, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const tables = order.tableIds?.length ?? 0;

    if (order.type === "DINE_IN" && tables < 1) fail("a dine-in order needs a table");
    if (order.type !== "DINE_IN" && tables > 0) fail("only a dine-in order has tables");
    if (order.type !== "DELIVERY" && order.deliveryAddress !== undefined) fail("only a delivery has an address");
    if (order.type === "DELIVERY" && (!order.customerName || !order.customerPhone || !order.deliveryAddress)) {
      fail("a delivery needs a name, a phone number and an address");
    }
  });

export const addOrderItemSchema = z.strictObject({
  clientItemId: z.uuid(),
  menuItemId: z.uuid(),
  quantity: z.number().int().min(1).max(99),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
  optionIds: z.array(z.uuid()).max(20).default([]),
});

export const billSchema = z.strictObject({ requested: z.boolean() });
export const transferTableSchema = z.strictObject({ fromTableId: z.uuid(), toTableId: z.uuid() });
export const mergeOrdersSchema = z.strictObject({ sourceOrderId: z.uuid() });

// ----- kitchen (Phase 6) -----
export const sendToKitchenSchema = z.strictObject({ clientSendId: z.uuid() });

const itemStatus = z.enum(["NEW", "PREPARING", "READY", "SERVED"]);
// `from` is what the screen believes the items are now. If someone else changed them first, the server refuses
// instead of overwriting, so a stale screen can never move a dish backwards by accident.
export const itemStatusChangeSchema = z.strictObject({
  itemIds: z.array(z.uuid()).min(1).max(60),
  from: itemStatus,
  to: itemStatus,
});
