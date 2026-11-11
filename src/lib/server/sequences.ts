import "server-only";
import type { Tx } from "./audit";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { counters } from "@/db/schema";

/**
 * Nomor dokumen berurutan & atomik per tipe + tahun.
 * Format: <PREFIX>-<YYYY>-<N4>   contoh ORD-2026-0001, CST-2026-0007.
 */
export async function nextSequentialNumber(
  prefix: string,
  opts: { year?: number; pad?: number } = {},
  exec: Tx | typeof db = db
): Promise<string> {
  const year = opts.year ?? new Date().getFullYear();
  const pad = opts.pad ?? 4;
  const name = `${prefix.toLowerCase()}:${year}`;

  await exec.insert(counters).values({ name, value: 0n }).onConflictDoNothing();
  const rows = await exec
    .update(counters)
    .set({ value: sql`${counters.value} + 1`, updatedAt: new Date() })
    .where(eq(counters.name, name))
    .returning({ value: counters.value });

  const n = rows[0]?.value ?? 0n;
  const seq = n.toString().padStart(pad, "0");
  if (n >= 10 ** pad) {
    // lanjut tanpa pad (keamanan ekstra bila melebihi kapasitas)
    return `${prefix}-${year}-${n.toString()}`;
  }
  return `${prefix}-${year}-${seq}`;
}