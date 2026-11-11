/**
 * Service data demo ERP (idempotent) — dipanggil dari server action Pengaturan
 * atau via CLI: npx tsx --env-file=.env src/db/seed/demo-modules.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { productionBatches, deliveryTasks, payrollRuns, payrollLines, kasbons, ziswafEntries, inventoryItems, inventoryMoves } from "@/db/schema/erp-extensions";
import { employees, attendanceRecords, departments, positions, businessUnits } from "@/db/schema/performance";
import { salesChannels } from "@/db/schema/performance";
import { quotations, orders, invoices, payments } from "@/db/schema/sales";
import { journals, journalLines, accounts, cashAccounts } from "@/db/schema/finance";
import { crmOrganizations, crmPeople, crmActivities } from "@/db/schema/crm-v2";
import { customers } from "@/db/schema/crm";
import { suppliers, animals } from "@/db/schema/ops";
import { vouchers } from "@/db/schema/sales";
import { customerComplaints } from "@/db/schema/performance";
import { kitchenTasks } from "@/db/schema/erp-extensions";
import { kpiIndicators, kpiTargets, kpiActuals, marketingSpends } from "@/db/schema/performance";
import { receivables } from "@/db/schema/sales";

const DEMO_TAG = "Data demo";
const EMP_PREFIX = "DEMO-EMP-";
const today = new Date();
const dw = (d: number) => new Date(today.getTime() + d * 86400000);

async function branchOf(): Promise<string> {
  const [u] = await db.select().from(users).where(sql`${users.email} = 'madaniaqiqah.superadmin@gmail.com'`).limit(1);
  if (!u?.branchId) throw new Error("admin utama belum ada");
  return u.branchId;
}

export async function clearDemoData() {
  await db.delete(employees).where(sql`${employees.employeeNumber} like ${EMP_PREFIX + "%"}`);
  await db.delete(inventoryItems).where(sql`${inventoryItems.notes} = ${DEMO_TAG}`);
  await db.delete(productionBatches).where(sql`${productionBatches.notes} = ${DEMO_TAG}`);
  await db.delete(deliveryTasks).where(sql`${deliveryTasks.notes} = ${DEMO_TAG}`);
  await db.delete(kasbons).where(sql`${kasbons.reason} like ${"%demo%"}`);
  await db.delete(ziswafEntries).where(sql`${ziswafEntries.note} = ${DEMO_TAG}`);
  await db.delete(payrollRuns).where(sql`${payrollRuns.note} = ${DEMO_TAG}`);
  await db.delete(quotations).where(sql`${quotations.quoteNumber} like ${"QTN-DEMO-%"}`);
  await db.delete(payments).where(sql`${payments.paymentNumber} like ${"PAY-DEMO-%"}`);
  await db.delete(invoices).where(sql`${invoices.invoiceNumber} like ${"INV-DEMO-%"}`);
  await db.delete(orders).where(sql`${orders.orderNumber} like ${"ORD-DEMO-%"}`);
  await db.delete(journalLines).where(sql`${journalLines.description} = ${"Baris Jurnal Demo"}`);
  await db.delete(journals).where(sql`${journals.description} like ${"%Jurnal Demo%"}`);
  await db.delete(deliveryTasks).where(sql`${deliveryTasks.notes} = ${DEMO_TAG}`); // sudah ada di atas
  await db.delete(crmActivities).where(sql`${crmActivities.title} like ${"Demo:%"}`);
  await db.delete(crmPeople).where(sql`${crmPeople.notes} = ${DEMO_TAG}`);
  await db.delete(crmOrganizations).where(sql`${crmOrganizations.notes} = ${DEMO_TAG}`);
  await db.delete(attendanceRecords).where(sql`${attendanceRecords.notes} = ${DEMO_TAG}`);
  await db.delete(departments).where(sql`${departments.name} like ${"DEMO %"}`);
  await db.delete(businessUnits).where(sql`${businessUnits.name} like ${"DEMO %"}`);
  await db.delete(salesChannels).where(sql`${salesChannels.name} like ${"DEMO %"}`);
  await db.delete(cashAccounts).where(sql`${cashAccounts.name} like ${"DEMO %"}`);
  await db.delete(kitchenTasks).where(sql`${kitchenTasks.description} like ${"DEMO %"}`);
  return { ok: true, message: "Data demo dihapus semua." };
}

export async function seedDemoData() {
  if (process.env.DEMO_ERP_CLEAR) return clearDemoData();
  const b = await branchOf();

  /* 1. Karyawan */
  const empDefs = [
    { employeeNumber: EMP_PREFIX + "0001", name: "Budi Santoso", phone: "0812-1111-2222", basicSalary: 4_500_000n, status: "AKTIF" as const },
    { employeeNumber: EMP_PREFIX + "0002", name: "Siti Aminah", phone: "0812-3333-4444", basicSalary: 3_800_000n, status: "AKTIF" as const },
    { employeeNumber: EMP_PREFIX + "0003", name: "Ahmad Faizi", phone: "0812-5555-6666", basicSalary: 5_200_000n, status: "AKTIF" as const },
    { employeeNumber: EMP_PREFIX + "0004", name: "Rani Puspita", phone: "0812-7777-8888", basicSalary: 3_500_000n, status: "AKTIF" as const },
    { employeeNumber: EMP_PREFIX + "0005", name: "Joko Surjanto", phone: "0812-9999-0000", basicSalary: 4_000_000n, status: "AKTIF" as const },
  ];
  const emps: Array<{ id: string; name: string; employeeNumber: string; basicSalary: bigint | null }> = [];
  for (const e of empDefs) {
    const [row] = await db
      .insert(employees)
      .values({ ...e, branchId: b })
      .onConflictDoUpdate({ target: employees.employeeNumber, set: { name: e.name, status: "AKTIF" } })
      .returning({ id: employees.id, name: employees.name, employeeNumber: employees.employeeNumber, basicSalary: employees.basicSalary });
    if (row) emps.push(row);
  }

  const [hasItems] = await db.select({ id: inventoryItems.id }).from(inventoryItems).where(sql`${inventoryItems.notes} = ${DEMO_TAG}`).limit(1);
  if (!hasItems) {
  /* 2. Inventaris + kartu stok awal */
  const itemDefs = [
    { name: "Paket Kambing — Gold", category: "PAKET", unit: "paket", qty: 12, minQty: 5, location: "Gudang Utama" },
    { name: "Paket Sapi — Full", category: "PAKET", unit: "paket", qty: 8, minQty: 3, location: "Gudang Utama" },
    { name: "Bumbu Marinasi Madani", category: "BAHAN", unit: "kg", qty: 45, minQty: 10, location: "Dapur" },
    { name: "Cardboard Packing Besar", category: "BAHAN", unit: "buah", qty: 60, minQty: 20, location: "Rak 3" },
    { name: "Aqiqah Olahan Seekor", category: "OLAHAN", unit: "pack", qty: 25, minQty: 10, location: "Freezer" },
    { name: "Sekop Sekaleng", category: "BAHAN", unit: "pcs", qty: 140, minQty: 50, location: "Gudang Utama" },
  ];
  const items = await db.insert(inventoryItems).values(itemDefs.map((i) => ({ ...i, branchId: b, notes: DEMO_TAG }))).returning({ id: inventoryItems.id, qty: inventoryItems.qty });
  for (const it of items) {
    if (it.qty > 0) {
      await db.insert(inventoryMoves).values({ itemId: it.id, direction: "IN", qty: it.qty, reason: "Stok awal (demo)" });
    }
  }
  }

  {
  /* 3. Produksi */
  const dateTag = today.toISOString().slice(0, 10).replace(/-/g, "");
  const runTag = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const mk = (n: number) => `BATCH-${dateTag}-${runTag}-${n}`;
  await db.insert(productionBatches).values([
    { branchId: b, batchNumber: mk(1), itemName: "Paket Kambing — Gold", qtyPlanned: 12, stage: "RPH" as const, qcStatus: "PENDING" as const, notes: DEMO_TAG },
    { branchId: b, batchNumber: mk(2), itemName: "Paket Sapi — Full", qtyPlanned: 8, stage: "MASAK" as const, qcStatus: "PENDING" as const, notes: DEMO_TAG },
    { branchId: b, batchNumber: mk(3), itemName: "Aqiqah Olahan Seekor", qtyPlanned: 20, stage: "QC" as const, qcStatus: "PASS" as const, notes: DEMO_TAG },
    { branchId: b, batchNumber: mk(4), itemName: "Paket Kambing — Silver", qtyPlanned: 15, stage: "SIAP" as const, qcStatus: "FAIL" as const, notes: DEMO_TAG + " (label salah)" },
  ]);
  }

  {
  /* 4. Pengiriman */
  await db.insert(deliveryTasks).values([
    { branchId: b, destination: "Jl. Cibaduyut No. 12, Bandung", contactName: "H. Ahmad Faizi", contactPhone: "0812-3456-7890", driverName: "Joko Surjanto", vehiclePlate: "B 9143 XY", scheduledAt: dw(0), status: "WAITING" as const, notes: DEMO_TAG },
    { branchId: b, destination: "Perum Bumi Asri Blok C-3", contactName: "Ibu Farida", contactPhone: "0813-2222-3333", driverName: "Budi Santoso", vehiclePlate: "D 1234 AB", scheduledAt: dw(0), status: "IN_TRANSIT" as const, notes: DEMO_TAG },
    { branchId: b, destination: "Yayasan Yatim Al-Ikhlas", contactName: "Ust. Rahmat", contactPhone: "0812-4444-5555", driverName: "Ahmad Faizi", vehiclePlate: "B 7788 KL", scheduledAt: dw(-1), status: "ARRIVED" as const, deliveredAt: dw(-1), notes: DEMO_TAG },
    { branchId: b, destination: "Jl. Raya Parung Ciwedus Km 3", contactName: "Pak Deni", contactPhone: "0856-1111-9999", driverName: "Rani Puspita", vehiclePlate: "F 2345 CD", scheduledAt: dw(-2), status: "GAGAL" as const, notes: DEMO_TAG + " (alamat sedikit ganda)" },
    { branchId: b, destination: "Apartemen Green Vista 12B", contactName: "Mbak Laras", contactPhone: "0812-8080-8080", driverName: "Joko Surjanto", vehiclePlate: "B 9143 XY", scheduledAt: dw(1), status: "WAITING" as const, notes: DEMO_TAG },
  ]);
  }

  const [hasRuns] = await db.select({ id: payrollRuns.id }).from(payrollRuns).where(sql`${payrollRuns.note} = ${DEMO_TAG}`).limit(1);
  if (!hasRuns) {
  /* 5. Payroll 2 periode */
  const nowP = today.toISOString().slice(0, 7);
  const prevP = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);
  for (const [period, status] of [[prevP, "FINAL"], [nowP, "DRAFT"]] as const) {
    const [run] = await db.insert(payrollRuns).values({ branchId: b, period, status, note: DEMO_TAG }).returning({ id: payrollRuns.id });
    let total = 0n;
    for (let i = 0; i < emps.length; i++) {
      const e = emps[i];
      const basic = e.basicSalary ?? 0n;
      const allowance = BigInt(250000 + (i % 3) * 150000);
      const deduction = i === 3 ? 100000n : 0n;
      const net = basic + allowance - deduction;
      total += net;
      await db.insert(payrollLines).values({
        runId: run.id,
        employeeId: e.id,
        employeeNumber: e.employeeNumber,
        employeeName: e.name,
        basic,
        allowance,
        deduction,
        net,
        note: i === 3 ? "Demo: potongan absensi" : null,
      });
    }
    await db.update(payrollRuns).set({ totalNet: total, ...(status === "FINAL" ? { finalizedAt: new Date() } : {}) }).where(sql`${payrollRuns.id} = ${run.id}`);
  }
  }

  const [hasKasbon] = await db.select({ id: kasbons.id }).from(kasbons).where(sql`${kasbons.reason} like ${"%demo%"}`).limit(1);
  if (!hasKasbon) {
  /* 6. Kasbon */
  await db.insert(kasbons).values([
    { branchId: b, employeeId: emps[0].id, employeeName: emps[0].name, employeeNumber: emps[0].employeeNumber, amount: 500000n, reason: "Belanja bumbu mendadak (demo)", status: "PENGAJUAN" as const },
    { branchId: b, employeeId: emps[1].id, employeeName: emps[1].name, employeeNumber: emps[1].employeeNumber, amount: 300000n, reason: "Solar pengiriman (demo)", status: "DISETUJUI" as const, approvedAt: new Date() },
    { branchId: b, employeeId: emps[2].id, employeeName: emps[2].name, employeeNumber: emps[2].employeeNumber, amount: 750000n, reason: "Perbaikan pisau dapur (demo)", status: "DIBAYAR" as const, approvedAt: new Date(), paidAt: new Date() },
    { branchId: b, employeeId: emps[4].id, employeeName: emps[4].name, employeeNumber: emps[4].employeeNumber, amount: 200000n, reason: "Pulsa operasional (demo)", status: "DIBATALKAN" as const },
  ]);
  }

  const [hasZiswaf] = await db.select({ id: ziswafEntries.id }).from(ziswafEntries).where(sql`${ziswafEntries.note} = ${DEMO_TAG}`).limit(1);
  if (!hasZiswaf) {
  /* 7. ZISWAF */
  await db.insert(ziswafEntries).values([
    { branchId: b, kind: "ZAKAT", direction: "IN", amount: 2_500_000n, party: "H. Abdul Malik", eventDate: dw(-6), note: DEMO_TAG },
    { branchId: b, kind: "ZAKAT", direction: "OUT", amount: 1_800_000n, party: "Mustahik RT 05", eventDate: dw(-4), note: DEMO_TAG },
    { branchId: b, kind: "INFAK", direction: "IN", amount: 1_200_000n, party: "Program Jumat Berbagi", eventDate: dw(-3), note: DEMO_TAG },
    { branchId: b, kind: "INFAK", direction: "OUT", amount: 600_000n, party: "Santunan anak yatim", eventDate: dw(-2), note: DEMO_TAG },
    { branchId: b, kind: "SEDEKAH", direction: "IN", amount: 400_000n, party: "Ibu Nurhayati", eventDate: dw(-5), note: DEMO_TAG },
    { branchId: b, kind: "SEDEKAH", direction: "OUT", amount: 250_000n, party: "Panti asuhan", eventDate: dw(-1), note: DEMO_TAG },
    { branchId: b, kind: "WAKAF", direction: "IN", amount: 5_000_000n, party: "Yayasan Al-Amin", eventDate: dw(-7), note: DEMO_TAG },
    { branchId: b, kind: "WAKAF", direction: "OUT", amount: 3_000_000n, party: "Renovasi tempat wudhu", eventDate: dw(0), note: DEMO_TAG },
  ]);
  }

  /* 8. Data induk demo (jika peran kosong) */
  const [bu] = await db.select({ id: businessUnits.id }).from(businessUnits).where(sql`${businessUnits.name} like ${"DEMO %"}`).limit(1);
  let buId = bu?.id ?? null;
  if (!buId) {
    const [row] = await db.insert(businessUnits).values({ code: "DEMO-BU", name: "DEMO Unit Aqiqah", description: DEMO_TAG }).returning({ id: businessUnits.id });
    buId = row.id;
  }
  const [dep] = await db.select({ id: departments.id }).from(departments).where(sql`${departments.name} like ${"DEMO %"}`).limit(1);
  let depId = dep?.id ?? null;
  if (!depId) {
    const [row] = await db.insert(departments).values({ code: "DEMO-DP", name: "DEMO Departemen Sales", businessUnitId: buId }).returning({ id: departments.id });
    depId = row.id;
  }
  const [ch] = await db.select({ id: salesChannels.id }).from(salesChannels).where(sql`${salesChannels.name} like ${"DEMO %"}`).limit(1);
  let chId = ch?.id ?? null;
  if (!chId) {
    const [row] = await db.insert(salesChannels).values({ code: "DEMO-CH", name: "DEMO Kanal Instagram", type: "ONLINE" }).returning({ id: salesChannels.id });
    chId = row.id;
  }
  await db.update(employees).set({ departmentId: depId }).where(sql`${employees.employeeNumber} like ${EMP_PREFIX + "%"}`);
  // jabatan demo bila tidak ada jabatan sama sekali
  const [{ c: posCount }] = await db.select({ c: sql<number>`count(*)::int` }).from(positions);
  if (Number(posCount) === 0) {
    await db.insert(positions).values([
      { code: "DEMO-POS1", name: "DEMO Koordinator Lapangan", departmentId: depId },
      { code: "DEMO-POS2", name: "DEMO CS Senior", departmentId: depId },
    ]);
  }

    /* 9. Kontak CRM: 2 organisasi + 5 orang */
  const [orgA] = await db.insert(crmOrganizations).values({ branchId: b, name: "Yayasan Al-Ikhlas (demo)", industry: "Pendidikan", phone: "022-5551111", email: "salam@alikhlas.demo.id", city: "Bandung", notes: DEMO_TAG }).returning({ id: crmOrganizations.id });
  const [orgB] = await db.insert(crmOrganizations).values({ branchId: b, name: "Senterprise Nusantara (demo)", industry: "Event Organizer", phone: "022-6662222", email: "cs@nusantara.demo.id", city: "Cimahi", notes: DEMO_TAG }).returning({ id: crmOrganizations.id });
  await db.insert(crmPeople).values([
    { branchId: b, organizationId: orgA.id, name: "Ust. Rahmat Hidayat", phone: "0812-4444-5555", whatsapp: "0812-4444-5555", email: "rahmat@alikhlas.demo.id", city: "Bandung", notes: DEMO_TAG },
    { branchId: b, organizationId: orgA.id, name: "Bu Siti Nurjanah", phone: "0813-8765-4321", whatsapp: "0813-8765-4321", email: "nurjanah@alikhlas.demo.id", city: "Bandung", notes: DEMO_TAG },
    { branchId: b, organizationId: orgB.id, name: "Pak Rendy Sanjaya", phone: "0821-1234-5678", whatsapp: "0821-1234-5678", email: "rendy@nusantara.demo.id", city: "Cimahi", notes: DEMO_TAG },
    { branchId: b, name: "Bu Laras Wulandari", phone: "0812-8080-8080", whatsapp: "0812-8080-8080", email: "laras.demo@indo.mail.com", city: "Bandung", notes: DEMO_TAG },
    { branchId: b, name: "H. Abdul Malik", phone: "0812-7777-1212", whatsapp: "0812-7777-1212", email: "malik.demo@indo.mail.com", city: "Bekasi", notes: DEMO_TAG },
  ]);

  /* 10. Aktivitas CRM */
  const [pFirst] = await db.select({ id: crmPeople.id }).from(crmPeople).where(sql`${crmPeople.notes} = ${DEMO_TAG}`).limit(1);
  if (pFirst) {
    await db.insert(crmActivities).values([
      { branchId: b, personId: pFirst.id, type: "CALL" as const, title: "Demo: Telefollow-up paket Gold", notes: "Minta dikirim katalog & estimasi.", dueAt: dw(0) },
      { branchId: b, personId: pFirst.id, type: "WHATSAPP" as const, title: "Demo: Kirim katalog WhatsApp", notes: "Sudah diteruskan; tunggu balasan.", completedAt: new Date() },
      { branchId: b, personId: pFirst.id, type: "MEETING" as const, title: "Demo: Kunjungan calon mitra acara", notes: "Rapat dengan yayasan.", dueAt: dw(3) },
    ]);
  }

  /* 11. Pesanan demo (3 status) + Penawaran + Invoice + Pembayaran */
  const [cus] = await db.select({ id: customers.id }).from(customers).limit(1);
  const todayStr = today.toISOString().slice(0, 10);
  const mkQ = (n: number) => `QTN-DEMO-${String(n).padStart(4, "0")}`;
  const mkO = (n: number) => `ORD-DEMO-${String(n).padStart(4, "0")}`;
  const mkI = (n: number) => `INV-DEMO-${String(n).padStart(4, "0")}`;
  const mkP = (n: number) => `PAY-DEMO-${String(n).padStart(4, "0")}`;

  const [q1] = await db.insert(quotations).values({ branchId: b, quoteNumber: mkQ(1), customerId: cus.id, status: "SENT", validUntil: dw(14), itemsTotal: 3_600_000n, total: 3_680_000n, shippingAmount: 80_000n, notes: DEMO_TAG }).returning({ id: quotations.id });
  await db.insert(quotations).values({ branchId: b, quoteNumber: mkQ(2), customerId: cus.id, status: "ACCEPTED", validUntil: dw(30), itemsTotal: 2_750_000n, total: 2_750_000n, notes: DEMO_TAG });
  await db.insert(quotations).values({ branchId: b, quoteNumber: mkQ(3), customerId: cus.id, status: "REJECTED", validUntil: dw(-5), itemsTotal: 1_800_000n, total: 1_800_000n, notes: DEMO_TAG + " (budget kurang)" });
  await db.insert(quotations).values({ branchId: b, quoteNumber: mkQ(4), customerId: cus.id, status: "DRAFT", itemsTotal: 4_200_000n, total: 4_200_000n, notes: DEMO_TAG + " (belum dikirim)" });

  const [o1] = await db.insert(orders).values({ branchId: b, orderNumber: mkO(1), customerId: cus.id, quoteId: q1.id, status: "ORDER_CONFIRMED", aqiqahType: "AKIKAH", shohibulName: "Bpk. Hermansyah", childName: "Foetus Abdul Aziz (demo)", aqiqahDate: dw(3), deliveryDate: dw(3), deliveryTimeSlot: "08:00-11:00", recipientName: "Bpk. Hermansyah", recipientPhone: "0812-1100-1010", deliveryAddress: "Jl. Anggrek No. 10 Bandung (demo)", deliveryCity: "Bandung", itemsTotal: 3_600_000n, shippingAmount: 80_000n, total: 3_680_000n, balance: 2_680_000n, channel: "ONLINE", referralSource: "Instagram (demo)", notes: DEMO_TAG, businessUnitId: buId, channelId: chId }).returning({ id: orders.id });
  const [o2] = await db.insert(orders).values({ branchId: b, orderNumber: mkO(2), customerId: cus.id, status: "SLAUGHTERED", aqiqahType: "AKIKAH", shohibulName: "Ibu Rohmah", childName: "Daffa Suka Sehat (demo)", aqiqahDate: dw(-1), deliveryDate: dw(1), deliveryTimeSlot: "13:00-15:00", recipientName: "Ibu Rohmah", recipientPhone: "0812-2200-2020", deliveryAddress: "Jl. Mawar No. 5 Cimahi (demo)", deliveryCity: "Cimahi", itemsTotal: 2_750_000n, total: 2_750_000n, balance: 0n, notes: DEMO_TAG, businessUnitId: buId, channelId: chId }).returning({ id: orders.id });
  await db.insert(orders).values({ branchId: b, orderNumber: mkO(3), customerId: cus.id, status: "COMPLETED", aqiqahType: "DONASI", shohibulName: "Yayasan Al-Ikhlas (demo)", deliveryDate: dw(-3), deliveryTimeSlot: "08:00-11:00", recipientName: "Ust. Rahmat", recipientPhone: "0812-4444-5555", deliveryAddress: "Al-Ikhlas Orphanage (demo)", deliveryCity: "Bandung", itemsTotal: 1_500_000n, total: 1_500_000n, balance: 0n, notes: DEMO_TAG, businessUnitId: buId, channelId: chId });

  const [inv1] = await db.insert(invoices).values({ branchId: b, invoiceNumber: mkI(1), orderId: o1.id, customerId: cus.id, status: "PARTIAL", issueDate: dw(0), dueDate: dw(7), itemsTotal: 3_600_000n, shippingAmount: 80_000n, total: 3_680_000n, totalPaid: 1_000_000n, balance: 2_680_000n }).returning({ id: invoices.id });
  await db.insert(invoices).values({ branchId: b, invoiceNumber: mkI(2), orderId: o2.id, customerId: cus.id, status: "PAID", issueDate: dw(-1), dueDate: dw(5), itemsTotal: 2_750_000n, total: 2_750_000n, totalPaid: 2_750_000n, balance: 0n });

  await db.insert(payments).values({ branchId: b, paymentNumber: mkP(1), invoiceId: inv1.id, orderId: o1.id, customerId: cus.id, amount: 1_000_000n, method: "TRANSFER", provider: "MANUAL", status: "CONFIRMED", paymentDate: dw(0), paidAt: dw(0), bankFrom: "BCA 8820 (demo)", bankTo: "Bank BSI", senderName: "Bpk. Hermansyah", notes: DEMO_TAG, reconciliationStatus: "MATCHED" });
  await db.insert(payments).values({ branchId: b, paymentNumber: mkP(2), invoiceId: inv1.id, orderId: o1.id, customerId: cus.id, amount: 680_000n, method: "QRIS", provider: "XENDIT", providerRef: "QRIS-DEMO-99", status: "PENDING", paymentDate: dw(1), notes: DEMO_TAG });
  await db.insert(payments).values({ branchId: b, paymentNumber: mkP(3), orderId: o2.id, customerId: cus.id, amount: 2_750_000n, method: "VA", provider: "BSI_VA", providerRef: "VA-DEMO-77", status: "CONFIRMED", paymentDate: dw(-1), paidAt: dw(-1), bankFrom: "BSI 3220 (demo)", bankTo: "Bank BSI", senderName: "Ibu Rohmah", notes: DEMO_TAG, reconciliationStatus: "MATCHED" });

  /* 12. Kas & Bank + Jurnal demo */
  const [hasCash] = await db.select({ id: cashAccounts.id }).from(cashAccounts).where(sql`${cashAccounts.name} like ${"DEMO %"}`).limit(1);
  if (!hasCash) {
    await db.insert(cashAccounts).values([
      { branchId: b, name: "DEMO Kas Operasional", type: "CASH", openingBalance: 2_000_000n },
      { branchId: b, name: "DEMO Bank BSI Operasional", type: "BANK", bankName: "Bank BSI (demo)", accountNumber: "3220998887", openingBalance: 12_500_000n },
    ]);
  }

  const [hasJ1x] = await db.select({ id: journals.id }).from(journals).where(sql`${journals.journalNumber} = ${"JV-DEMO-0001"}`).limit(1);
  const j1 = hasJ1x ?? (await db.insert(journals).values({ branchId: b, journalNumber: "JV-DEMO-0001", journalDate: dw(-2), type: "EXPENSE", status: "POSTED", description: "Beli bahan dapur (Jurnal Demo)", debitTotal: 850_000n, creditTotal: 850_000n, postedAt: dw(-2) }).returning({ id: journals.id }))[0];
  const [accExpense] = await db.select({ id: accounts.id }).from(accounts).where(sql`${accounts.type} = ${"EXPENSE"}`).limit(1);
  let [accCash] = await db.select({ id: accounts.id }).from(accounts).where(sql`${accounts.code} like ${"1-1101%"}`).limit(1);
  if (!accCash) [accCash] = await db.select({ id: accounts.id }).from(accounts).where(sql`${accounts.type} = ${"ASSET"}`).limit(1);
  const [accIncomeTest] = await db.select({ id: accounts.id }).from(accounts).where(sql`${accounts.type} = ${"INCOME"}`).limit(1);
  await db.insert(journalLines).values([
    { journalId: j1.id, accountId: accExpense.id, debit: 850_000n, credit: 0n, description: "Baris Jurnal Demo — beban bahan" },
    { journalId: j1.id, accountId: accCash.id, debit: 0n, credit: 850_000n, description: "Baris Jurnal Demo — keluar kas" },
  ]);
  const [hasJ2] = await db.select({ id: journals.id }).from(journals).where(sql`${journals.journalNumber} = ${"JV-DEMO-0002"}`).limit(1);
  const j2 = hasJ2 ?? (await db.insert(journals).values({ branchId: b, journalNumber: "JV-DEMO-0002", journalDate: dw(-1), type: "INCOME", status: "POSTED", description: "Hasil penjualan aqiqah (Jurnal Demo)", debitTotal: 1_500_000n, creditTotal: 1_500_000n, postedAt: dw(-1) }).returning({ id: journals.id }))[0];
  await db.insert(journalLines).values([
    { journalId: j2.id, accountId: accCash.id, debit: 1_500_000n, credit: 0n, description: "Baris Jurnal Demo — masuk kas" },
    { journalId: j2.id, accountId: accIncomeTest.id, debit: 0n, credit: 1_500_000n, description: "Baris Jurnal Demo — pendapatan" },
  ]);

  /* 13. Absensi hari ini (5 karyawan demo) */
  const todayDate = todayStr;
  const demoEmps = await db.select().from(employees).where(sql`${employees.employeeNumber} like ${EMP_PREFIX + "%"}`);
  const statuses = ["HADIR", "HADIR", "TERLAMBAT", "IZIN", "ALPA"] as const;
  for (let i = 0; i < demoEmps.length; i++) {
    await db
      .insert(attendanceRecords)
      .values({ employeeId: demoEmps[i].id, date: todayDate, status: statuses[i] ?? "HADIR", checkIn: statuses[i] === "HADIR" ? new Date(today.getTime() - 3600000) : null, lateMinutes: statuses[i] === "TERLAMBAT" ? 15 : 0, notes: DEMO_TAG })
      .onConflictDoNothing();
  }



  /* 14. Supplier demo */
  const [hasSup] = await db.select({ id: suppliers.id }).from(suppliers).where(sql`${suppliers.name} like ${"DEMO %"}`).limit(1);
  let supA: string | null = hasSup?.id ?? null;
  if (!hasSup) {
    const supRows = await db
      .insert(suppliers)
      .values([
        { name: "DEMO CV Berkah Ternak", type: "HEWAN", phone: "0812-7000-1001", city: "Boyolali", notes: DEMO_TAG },
        { name: "DEMO UD Sapi Makmur", type: "HEWAN", phone: "0812-7000-1002", city: "Blitar", notes: DEMO_TAG },
        { name: "DEMO Bahandie Grosir", type: "BAHAN", phone: "0812-7000-1003", city: "Bandung", notes: DEMO_TAG },
        { name: "DEMO Jasa Renderer", type: "JASA", phone: "0812-7000-1004", city: "Jakarta", notes: DEMO_TAG },
      ])
      .returning({ id: suppliers.id, name: suppliers.name });
    supA = supRows[0]?.id ?? null;
  }

  /* 15. Hewan ternak demo (herd) */
  if (supA) {
    const [hasAnimal] = await db.select({ id: animals.id }).from(animals).where(sql`${animals.tagNumber} like ${"DEMO%"}`).limit(1);
    if (!hasAnimal) {
      await db.insert(animals).values([
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Etawa", tagNumber: "DEMO-K01", weightKg: "28", ageMonths: "8", gender: "JANTAN", status: "AVAILABLE", purchasePrice: 1_750_000n, pen: "DEMO Kandang A", purchasedAt: dw(-14), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Etawa", tagNumber: "DEMO-K02", weightKg: "31", ageMonths: "9", gender: "JANTAN", status: "AVAILABLE", purchasePrice: 1_900_000n, pen: "DEMO Kandang A", purchasedAt: dw(-14), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Jawarandu", tagNumber: "DEMO-K03", weightKg: "27", ageMonths: "8", gender: "BETINA", status: "AVAILABLE", purchasePrice: 1_500_000n, pen: "DEMO Kandang A", purchasedAt: dw(-12), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Jawarandu", tagNumber: "DEMO-K04", weightKg: "29", ageMonths: "9", gender: "BETINA", status: "AVAILABLE", purchasePrice: 1_600_000n, pen: "DEMO Kandang B", purchasedAt: dw(-12), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Etawa", tagNumber: "DEMO-K05", weightKg: "30", ageMonths: "10", gender: "JANTAN", status: "RESERVED", purchasePrice: 2_100_000n, pen: "DEMO Kandang B", purchasedAt: dw(-10), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "KAMBING", breed: "Etawa", tagNumber: "DEMO-K06", weightKg: "33", ageMonths: "10", gender: "JANTAN", status: "RESERVED", purchasePrice: 2_300_000n, pen: "DEMO Kandang B", purchasedAt: dw(-10), skkhNumber: "DEMO-SKKH-0001", notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "SAPI", breed: "Limousin", tagNumber: "DEMO-S01", weightKg: "380", ageMonths: "24", gender: "JANTAN", status: "AVAILABLE", purchasePrice: 18_500_000n, pen: "DEMO Kandang Sapi", purchasedAt: dw(-20), notes: DEMO_TAG },
        { branchId: b, supplierId: supA, species: "SAPI", breed: "Limousin", tagNumber: "DEMO-S02", weightKg: "410", ageMonths: "26", gender: "JANTAN", status: "AVAILABLE", purchasePrice: 20_000_000n, pen: "DEMO Kandang Sapi", purchasedAt: dw(-20), skkhNumber: "DEMO-SKKH-0002", notes: DEMO_TAG },
      ]);
    }
  }

  /* 16. Voucher demo */
  const [hasVc] = await db.select({ id: vouchers.id }).from(vouchers).where(sql`${vouchers.code} like ${"DEMO%"}`).limit(1);
  if (!hasVc) {
    await db.insert(vouchers).values({ code: "DEMO-AQI10", type: "PERCENT", percentBps: 1000, maxUsage: 50, startsAt: dw(-7), expiresAt: dw(30), isActive: true });
    await db.insert(vouchers).values({ code: "DEMO-POTONG100", type: "NOMINAL", nominalAmount: 100_000n, maxUsage: 20, startsAt: dw(-7), expiresAt: dw(14), isActive: true });
    await db.insert(vouchers).values({ code: "DEMO-GRATIS-ONGKIR", type: "FREE_DELIVERY", maxUsage: 10, startsAt: dw(-7), expiresAt: dw(7), isActive: true });
    await db.insert(vouchers).values({ code: "DEMO-EXPIRED", type: "NOMINAL", nominalAmount: 250_000n, maxUsage: 5, startsAt: dw(-30), expiresAt: dw(-7), isActive: true });
  }

  /* 17. Keluhan pelanggan demo */
  const [hasComp] = await db.select({ id: customerComplaints.id }).from(customerComplaints).where(sql`${customerComplaints.description} like ${"DEMO %"}`).limit(1);
  if (!hasComp) {
    await db.insert(customerComplaints).values([
      { branchId: b, orderId: o1.id, customerId: cus.id, channel: "WA", category: "PORSI", severity: "SEDANG", description: "DEMO: porsi bumbu terasa kurang cocok", receivedAt: dw(-2), status: "BARU" },
      { branchId: b, orderId: o2.id, customerId: cus.id, channel: "TELEPON", category: "KIRIMAN", severity: "TINGGI" as never, description: "DEMO: kiriman terlambat 40 menit", receivedAt: dw(-1), status: "DIPROSES" },
      { branchId: b, customerId: cus.id, channel: "TATAP_MUKA", category: "PELAYANAN", severity: "RENDAH" as never, description: "DEMO: petugas kurang ramah saat survei", receivedAt: dw(-3), resolvedAt: dw(-2), status: "SELESAI", resolution: "Minta maaf + kejaruns penawaran gratis" },
      { branchId: b, channel: "EMAIL", category: "KEBERSIHAN", severity: "SEDANG" as never, description: "DEMO: kemasan tampak kurang bersih", receivedAt: dw(-4), resolvedAt: dw(-3), status: "SELESAI", resolution: "Ganti kemasan & recall unit" },
    ]);
  }

  /* 18. Tugas dapur demo */
  const [hasKi] = await db.select({ id: kitchenTasks.id }).from(kitchenTasks).where(sql`${kitchenTasks.description} like ${"DEMO %"}`).limit(1);
  if (!hasKi) {
    await db.insert(kitchenTasks).values([
      { branchId: b, orderId: o1.id, description: "DEMO: Rendam kunyit + asam — bumbu utama", quantity: 10, status: "MENUNGGU" },
      { branchId: b, orderId: o1.id, description: "DEMO: Potong rempah ayam kampung", quantity: 4, status: "SIAP", doneAt: dw(-1) },
      { branchId: b, orderId: o2.id, description: "DEMO: Marinasi 2 paket Sapi Premium", quantity: 2, status: "MENUNGGU" },
      { branchId: b, orderId: o2.id, description: "DEMO: Sanitasi rak perasan", quantity: 1, status: "SIAP", doneAt: dw(0) },
    ]);
  }

  /* 19. Piutang demo (inv1 PARTIAL) */
  const [hasRec] = await db.select({ id: receivables.id }).from(receivables).where(sql`${receivables.amount} = 3680000`).limit(1);
  if (!hasRec) {
    await db.insert(receivables).values([
      { branchId: b, invoiceId: inv1.id, customerId: cus.id, amount: 3_680_000n, settledAmount: 1_000_000n, balance: 2_680_000n, status: "PARTIAL", dueDate: dw(7) },
    ]);
  }

  /* 20. Marketing spends + KPI demo */
  const [hasMkt] = await db.select({ id: marketingSpends.id }).from(marketingSpends).where(sql`${marketingSpends.notes} = ${DEMO_TAG}`).limit(1);
  if (!hasMkt) {
    await db.insert(marketingSpends).values([
      { branchId: b, channelId: chId, periodStart: todayStr, periodEnd: todayStr, amount: 800_000n, notes: DEMO_TAG },
    ]);
  }
  const [hasKpi] = await db.select({ id: kpiIndicators.id }).from(kpiIndicators).where(sql`${kpiIndicators.code} like ${"DEMO%"}`).limit(1);
  if (!hasKpi) {
    const kpiDefs = await db
      .insert(kpiIndicators)
      .values([
        { code: "DEMO-OMZET", name: "Omzet bulanan", scope: "COMPANY", unit: "CURRENCY", direction: "HIGHER_BETTER", frequency: "MONTHLY", defaultWeight: "40" },
        { code: "DEMO-LEADS", name: "Leads baru", scope: "COMPANY", unit: "COUNT", direction: "HIGHER_BETTER", frequency: "MONTHLY", defaultWeight: "30" },
        { code: "DEMO-ONTIME", name: "Pengiriman tepat waktu", scope: "COMPANY", unit: "PERCENT", direction: "HIGHER_BETTER", frequency: "MONTHLY", defaultWeight: "30" },
      ])
      .returning({ id: kpiIndicators.id, code: kpiIndicators.code });
    const pmStart = today.toISOString().slice(0, 10);
    const periodEnd = todayStr;
    for (const k of kpiDefs) {
      const target = k.code === "DEMO-OMZET" ? "50000000" : k.code === "DEMO-LEADS" ? "150" : "95";
      const actual = k.code === "DEMO-OMZET" ? "43000000" : k.code === "DEMO-LEADS" ? "120" : "88";
      await db.insert(kpiTargets).values({ indicatorId: k.id, branchId: b, periodType: "MONTHLY", periodStart: pmStart, periodEnd: periodEnd, targetValue: target, weight: "10", notes: DEMO_TAG });
      await db.insert(kpiActuals).values({ indicatorId: k.id, branchId: b, periodType: "MONTHLY", periodStart: pmStart, periodEnd: periodEnd, actualValue: actual, source: "MANUAL", status: "VERIFIED", notes: DEMO_TAG });
    }
  }

  return { ok: true, message: "Data demo berhasil dibuat." };

}

