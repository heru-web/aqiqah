import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { listCustomers } from "@/server/services/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getAuth();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "customers.customers.view")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "excel").toLowerCase();
  const scope = { branchId: user.branchId ?? undefined, search: searchParams.get("q") ?? undefined, pageSize: 1000 };
  const first = await listCustomers(scope);
  const rows = [...first.rows];
  for (let page = 2; rows.length < first.total; page += 1) {
    const batch = await listCustomers({ ...scope, page });
    if (!batch.rows.length) break;
    rows.push(...batch.rows);
  }
  if (format === "pdf") {
    const jsPDF = (await import("jspdf")).default;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Data Pelanggan — Madani Aqiqah", 14, 16);
    let y = 28;
    for (const r of rows) {
      doc.text(`${r.code} | ${r.name} | ${r.type} | ${r.phone ?? "-"} | ${r.city ?? "-"}`, 14, y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 16;
      }
    }
    const buf = doc.output("arraybuffer");
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=customers.pdf" },
    });
  }
  const XLSX = (await import("xlsx")) as typeof import("xlsx");
  const data = rows.map((r) => ({
    Kode: r.code,
    Nama: r.name,
    Tipe: r.type,
    Telepon: r.phone ?? "",
    WhatsApp: r.whatsapp ?? "",
    Email: r.email ?? "",
    Alamat: r.address ?? "",
    Kota: r.city ?? "",
    Provinsi: r.province ?? "",
    NPWP: r.npwp ?? "",
    Sumber: r.source ?? "",
    Catatan: r.notes ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=customers.xlsx",
    },
  });
}
