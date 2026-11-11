import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { createCustomer } from "@/server/services/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportRow {
  name: string;
  type?: "PERUSAHAAN" | "PERORANGAN";
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  npwp?: string;
  source?: string;
  notes?: string;
}

export async function POST(req: Request) {
  const user = await getAuth();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "customers.customers.create")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const body = (await req.json()) as { rows?: ImportRow[] };
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length > 500) {
    return NextResponse.json({ ok: false, reason: "MAKS 500 BARIS" }, { status: 400 });
  }
  let created = 0;
  for (const row of rows) {
    if (!row?.name) continue;
    await createCustomer(
      {
        name: row.name,
        type: row.type ?? "PERORANGAN",
        phone: row.phone || undefined,
        whatsapp: row.whatsapp || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        city: row.city || undefined,
        province: row.province || undefined,
        npwp: row.npwp || undefined,
        source: row.source || undefined,
        notes: row.notes || undefined,
      },
      user
    );
    created += 1;
  }
  return NextResponse.json({ ok: true, created });
}
