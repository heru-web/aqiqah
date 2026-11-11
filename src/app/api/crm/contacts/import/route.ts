import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { db } from "@/db";
import { crmPeople as people, crmOrganizations as organizations } from "@/db/schema/crm-v2";
import { findDuplicatePerson } from "@/server/services/crm";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  organization?: string;
}

export async function POST(req: Request) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "crm.pipeline.create")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const body = (await req.json()) as { rows?: Row[] };
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length > 500) return NextResponse.json({ ok: false, reason: "MAKS 500 BARIS" }, { status: 400 });
  if (!user.branchId) return NextResponse.json({ ok: false, reason: "BRANCH BELUM DIATUR" }, { status: 400 });

  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r?.name) continue;
    let orgId: string | null = null;
    if (r.organization) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.name} ilike ${r.organization} and ${organizations.branchId} = ${user.branchId}`)
        .limit(1);
      if (org) orgId = org.id;
    }
    const duplicate = await findDuplicatePerson({
      branchId: user.branchId,
      organizationId: orgId,
      name: r.name,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
    });
    if (duplicate) {
      skipped += 1;
      continue;
    }
    await db.insert(people).values({
      branchId: user.branchId,
      name: r.name,
      phone: r.phone ?? null,
      whatsapp: r.whatsapp ?? null,
      email: r.email ?? null,
      city: r.city ?? null,
      organizationId: orgId,
    });
    created += 1;
  }
  return NextResponse.json({ ok: true, created, skipped });
}
