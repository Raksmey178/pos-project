export const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED", "BILL_REQUESTED"] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];
