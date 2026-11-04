import { z } from "zod";
import { MAX_TABLE_SIZE, MIN_TABLE_SIZE } from "../floor-plan";

// strictObject: unknown fields are rejected.
const name = z.string().trim().min(1).max(20);
const zoneName = z.string().trim().min(1).max(40);
const sortOrder = z.number().int().min(0).max(100_000);
const capacity = z.number().int().min(1).max(50);
const shape = z.enum(["RECT", "ROUND"]);
const size = z.number().int().min(MIN_TABLE_SIZE).max(MAX_TABLE_SIZE);
const cell = z.number().int().min(0).max(100); // the exact grid limits are checked on the server

const notEmpty = (value: object) => Object.keys(value).length > 0;

export const createZoneSchema = z.strictObject({ name: zoneName, sortOrder: sortOrder.optional() });
export const updateZoneSchema = z
  .strictObject({ name: zoneName, sortOrder, isActive: z.boolean() })
  .partial()
  .refine(notEmpty);

export const createTableSchema = z
  .strictObject({
    zoneId: z.uuid(),
    name,
    capacity,
    shape,
    width: size,
    height: size,
    // Leave out gridX and gridY to put the table in the first free spot.
    gridX: cell.optional(),
    gridY: cell.optional(),
  })
  .refine((table) => (table.gridX === undefined) === (table.gridY === undefined));

export const updateTableSchema = z
  .strictObject({
    zoneId: z.uuid(),
    name,
    capacity,
    shape,
    width: size,
    height: size,
    gridX: cell,
    gridY: cell,
    isActive: z.boolean(),
  })
  .partial()
  .refine(notEmpty);
