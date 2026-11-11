import "server-only";
import { auditLogs, type auditAction } from "@/db/schema";
import { db } from "@/db";
import type { AuthUser } from "@/lib/server/auth";

export type AuditAction = (typeof auditAction.enumValues)[number];
export type TxExecutor = typeof db.transaction;
export type Tx = Parameters<Parameters<TxExecutor>[0]>[0];

export interface WriteAuditInput {
  actor: AuthUser;
  action: AuditAction;
  module: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Tulis audit log. Dipanggil di dalam transaksi bila bertransaksi,
 * atau langsung bila operasi tunggal. Value sebelum/sesudah harus
 * data terbatas (jangan sertakan hash/secret).
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await insertAudit(db, input);
}

const serialize = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);

/** Versi transaksional — dipakai dalam `db.transaction`. */
export async function insertAudit(tx: Tx | typeof db, input: WriteAuditInput): Promise<void> {
  await tx.insert(auditLogs).values({
    actorUserId: input.actor.id,
    actorRoleIds: input.actor.roles,
    action: input.action,
    module: input.module,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    before: input.before ? serialize(input.before) : null,
    after: input.after ? serialize(input.after) : null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: input.metadata ? serialize(input.metadata) : null,
  });
}