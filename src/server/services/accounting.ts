import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { journals } from "@/db/schema";

export async function listJournals(opts: { limit?: number; branchId?: string | null } = {}) {
  const limit = opts.limit ?? 100;
  return db.select().from(journals).where(opts.branchId ? eq(journals.branchId, opts.branchId) : undefined).orderBy(desc(journals.journalDate)).limit(limit);
}
