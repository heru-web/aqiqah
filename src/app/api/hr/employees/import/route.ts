import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { db } from "@/db";
import { employees } from "@/db/schema/performance";
import { count, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  employeeNumber?: string;
  name?: string;
  phone?: string;
  joinedAt?: string;
  status?: string;
  basicSalary?: string;
}

export async function POST(req: Request) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "employees.employees.create")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const body = (await req.json()) as { rows?: Row[] };
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length > 500) return NextResponse.json({ ok: false, reason: "MAKS 500 BARIS" }, { status: 400 });
  if (!user.branchId) return NextResponse.json({ ok: false, reason: "BRANCH BELUM DIATUR" }, { status: 400 });

  const [{ c }] = await db.select({ c: count() }).from(employees);
  let seq = Number(c);
  let created = 0;
  for (const r of rows) {
    if (!r?.name) continue;
    seq += 1;
    const employeeNumber = r.employeeNumber?.trim() || `EMP-${String(seq).padStart(4, "0")}`;
    const basic = r.basicSalary?.replace(/[^\d]/g, "");
    await db.insert(employees).values({
      branchId: user.branchId,
      employeeNumber,
      name: r.name.trim(),
      phone: r.phone ?? null,
      joinedAt: r.joinedAt && !Number.isNaN(new Date(r.joinedAt).getTime()) ? r.joinedAt.slice(0, 10) : null,
      status: "AKTIF",
      basicSalary: basic ? BigInt(basic) : null,
    });
    created += 1;
  }
  return NextResponse.json({ ok: true, created });
}
