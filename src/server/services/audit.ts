import type { Prisma } from "@/generated/prisma/client";

// Pass either the normal client or the `tx` of a transaction, so the audit row
// is saved (or rolled back) together with the change it describes.
type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export type AuditEntry = {
  /** Who did it. null when nobody was logged in (a failed login, for example). */
  actorId?: string | null;
  action: string; // "auth.login", "staff.create", ...
  entityType?: string;
  entityId?: string;
  /** Small facts only. NEVER a PIN, a hash or a token. */
  details?: Prisma.InputJsonObject;
};

export async function writeAudit(client: AuditClient, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
    },
  });
}
