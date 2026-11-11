import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";

/**
 * Ambil baris pertama dari query SQL mentah (postgres-js `execute`).
 * Mengembalikan `undefined` bila tidak ada baris.
 */
export async function firstRow<TRow extends Record<string, unknown>>(query: SQL): Promise<TRow | undefined> {
  const rows = await db.execute<TRow>(query);
  return rows[0] as unknown as TRow | undefined;
}
