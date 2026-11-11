import "server-only";
import { eq } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import * as extensions from "@/db/schema/erp-extensions";
import type { AuthUser } from "./auth";
import type { Tx } from "./audit";
import { assertBranchAccess } from "@/lib/branch-access";
import { NotFoundError } from "@/lib/errors";

const resources = {
  inventory: extensions.inventoryItems, payroll: extensions.payrollRuns, kasbon: extensions.kasbons,
  production: extensions.productionBatches, delivery: extensions.deliveryTasks, ziswaf: extensions.ziswafEntries,
  order: schema.orders, invoice: schema.invoices, payment: schema.payments,
  customer: schema.customers, employee: schema.employees, cash: schema.cashAccounts,
  deal: schema.crmDeals, person: schema.crmPeople, organization: schema.crmOrganizations,
  activity: schema.crmActivities, lead: schema.leads,
  animal: schema.animals, complaint: schema.customerComplaints, kitchen: extensions.kitchenTasks,
  quotation: schema.quotations,
} satisfies Record<string, PgTable & { id: AnyPgColumn; branchId: AnyPgColumn }>;

export type BranchResource = keyof typeof resources | "supplier" | "followup";

/** Validate untrusted IDs before reads, mutations and external side effects. */
export async function assertResourceAccess(resource: BranchResource, id: string, actor: AuthUser, exec: Tx | typeof db = db): Promise<void> {
  if (resource === "followup") {
    const [row] = await exec.select({ leadId: schema.leadFollowups.leadId }).from(schema.leadFollowups).where(eq(schema.leadFollowups.id, id)).limit(1);
    if (!row) throw new NotFoundError();
    return assertResourceAccess("lead", row.leadId, actor, exec);
  }
  if (resource === "supplier") {
    const [row] = await exec.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).limit(1);
    if (!row) throw new NotFoundError();
    return; // Supplier master is shared across branches in the existing schema.
  }
  const table: PgTable & { id: AnyPgColumn; branchId: AnyPgColumn } = resources[resource];
  const [row] = await exec.select({ branchId: table.branchId }).from(table).where(eq(table.id, id)).limit(1);
  if (!row) throw new NotFoundError();
  assertBranchAccess(actor, row.branchId as string | null);
}

export function branchWhere(actor: AuthUser, column: AnyPgColumn) {
  if (actor.branchId) return eq(column, actor.branchId);
  assertBranchAccess(actor, null);
  return undefined;
}

/** For page-facing services without an explicit actor argument. */
export async function currentBranchWhere(column: AnyPgColumn, shared = false) {
  const { requireAuth } = await import("./auth");
  const actor = await requireAuth();
  const condition = branchWhere(actor, column);
  if (!condition) return undefined;
  if (!shared) return condition;
  const { or, isNull } = await import("drizzle-orm");
  return or(condition, isNull(column));
}
