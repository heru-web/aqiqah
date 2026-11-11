/**
 * Modul Alarm — notifikasi PANEL APP (lonceng) sesuai aturan harian.
 * Penerima: peran (SUPERADM / SALES / MARKETING / OPS / HR / CS / ALL).
 */
import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { waAlertRules, waAlertsLog, inventoryItems } from "@/db/schema/erp-extensions";
import {
  dailyScorecards,
  dailyScorecardLines,
  kpiIndicators,
  departments,
  employees,
  attendanceRecords,
} from "@/db/schema/performance";
import { crmActivities, crmPeople, crmDeals } from "@/db/schema/crm-v2";
import { orders } from "@/db/schema/sales";
import { customers } from "@/db/schema/crm";
import { sendWhatsapp } from "@/server/services/whatsapp";
import { branches, notifications, users, userRoles, roles } from "@/db/schema";
import { renderWhatsappTemplate } from "@/lib/whatsapp";

export interface RuleRow {
  id: string;
  code: string;
  enabled: boolean;
  sendHour: number;
  sendMinute: number;
  /** CSV slug role, cth "SUPERADM,OPS". */
  targetRoles: string;
  onlyWeekdays: boolean;
  template: string | null;
  lastSentAt: Date | null;
}

export interface RuleView extends RuleRow {
  label: string;
  desc: string;
}

export const ALERT_RULE_META: Record<
  string,
  { label: string; desc: string; defaultHour: number; defaultMinute: number; placeholder: string; defaultRoles: string }
> = {
  SCORECARD_BELUM_ISI: {
    label: "Laporan harian belum diisi",
    desc: "Departemen yang belum mengisi scorecard harian hari ini.",
    defaultHour: 20,
    defaultMinute: 0,
    placeholder: "Laporan harian {tanggal} belum diisi oleh: {daftar}. Mohon segera dilengkapi, terima kasih!",
    defaultRoles: "SUPERADM,OPS,HR",
  },
  SCORECARD_TAK_TERCAPAI: {
    label: "Target harian tak tercapai",
    desc: "Indikator dengan aktual di bawah target pada scorecard hari ini (arah LOWER_BETTER dibalikotomatis).",
    defaultHour: 20,
    defaultMinute: 30,
    placeholder: "Target harian {tanggal} belum tercapai: {daftar}. Mari evaluasi & perbaiki besok!",
    defaultRoles: "SUPERADM,OPS",
  },
  FOLLOWUP_TERLAMBAT: {
    label: "Follow-up CRM terlambat",
    desc: "Aktivitas CRM yang melewati batas waktu & belum selesai.",
    defaultHour: 8,
    defaultMinute: 0,
    placeholder: "Follow-up terlambat per {tanggal}: {daftar}. Segera hubungi calon ya!",
    defaultRoles: "SUPERADM,SALES,MARKETING,CS",
  },
  STOK_MINIM: {
    label: "Stok menipis",
    desc: "Item inventaris di bawah/di ambang batas minimum.",
    defaultHour: 21,
    defaultMinute: 0,
    placeholder: "Stok menipis per {tanggal}: {daftar}. Mohon restock segera!",
    defaultRoles: "SUPERADM,OPS",
  },
  ORDER_REMINDER_J3: {
    label: "Pengingat pengiriman J-3",
    desc: "Pesanan kiruan yang berjanggal 3 hari lagi → peringatan tim + WA ke pelanggan.",
    defaultHour: 9,
    defaultMinute: 0,
    placeholder: "Pengingat kiriman J-3 ({tanggal}): {daftar}. Mohon cek persiapan & kirim konfirmasiWA ke pelanggan.",
    defaultRoles: "SUPERADM,OPS",
  },
  ORDER_THANKYOU: {
    label: "Ucapan terima kasih selesai kiriman",
    desc: "Pesanan yang STATUS kiriman selesai hari ini → WA terima kasih ke pelanggan (sekali per hari).",
    defaultHour: 19,
    defaultMinute: 30,
    placeholder: "Ucapan terima kasih kiriman {tanggal}: {daftar}. Pesan WA juga dikirim ke pelanggan.",
    defaultRoles: "SUPERADM,OPS",
  },
  ABSENSI_BELUM_LAPOR: {
    label: "Absensi belum tercatat",
    desc: "Karyawan aktif yang belum ada catatan absensi hari ini.",
    defaultHour: 17,
    defaultMinute: 30,
    placeholder: "Belum tercatat absensi {tanggal}: {daftar}. Mohon lengkapi presensi hari ini.",
    defaultRoles: "SUPERADM,HR",
  },
};

const RULE_CODES = Object.keys(ALERT_RULE_META);

const ROLE_SLUGS: Record<string, string[]> = {
  SUPERADM: ["superadmin"],
  SALES: ["sales"],
  MARKETING: ["marketing"],
  OPS: ["ops"],
  HR: ["hr"],
  CS: ["cs", "sales"],
  ACCT: ["acct"],
  ALL: ["superadmin", "sales", "marketing", "cs", "ops", "hr", "acct"],
};

export const TARGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SUPERADM", label: "Super Admin saja" },
  { value: "SUPERADM,SALES,MARKETING,CS", label: "Tim Penjualan (Sales & CS)" },
  { value: "SUPERADM,OPS", label: "Operasional" },
  { value: "SUPERADM,HR", label: "HR" },
  { value: "ALL", label: "Semua peran" },
];

function toJak(now: Date): Date {
  return new Date(now.getTime() + 7 * 3600_000);
}

/** Ambil seluruh aturan + inisialiasi default bila belum ada. */
export async function listRules(): Promise<RuleView[]> {
  let rows = await db.select().from(waAlertRules);
  const have = new Set(rows.map((r) => r.code));
  for (const code of RULE_CODES.filter((c) => c !== "ABSENSI_BELUM_LAPOR")) {
    if (!have.has(code)) {
      const meta = ALERT_RULE_META[code];
      await db
        .insert(waAlertRules)
        .values({
          code,
          enabled: false,
          sendHour: meta.defaultHour,
          sendMinute: meta.defaultMinute,
          targetRoles: meta.defaultRoles,
        })
        .onConflictDoNothing();
    }
  }
  rows = await db.select().from(waAlertRules).orderBy(asc(waAlertRules.code));
  return rows.filter((r) => r.code !== "ABSENSI_BELUM_LAPOR").map((r) => ({
    id: r.id,
    code: r.code,
    enabled: r.enabled,
    sendHour: r.sendHour,
    sendMinute: r.sendMinute,
    targetRoles: (r as unknown as { targetRoles?: string | null }).targetRoles ?? "SUPERADM",
    onlyWeekdays: r.onlyWeekdays,
    template: r.template,
    lastSentAt: r.lastSentAt,
    label: ALERT_RULE_META[r.code]?.label ?? r.code,
    desc: ALERT_RULE_META[r.code]?.desc ?? "",
  }));
}

export async function updateRule(
  id: string,
  patch: Partial<Pick<RuleRow, "enabled" | "sendHour" | "sendMinute" | "targetRoles" | "onlyWeekdays" | "template">>
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (patch.enabled !== undefined) clean.enabled = patch.enabled;
  if (patch.sendHour !== undefined) clean.sendHour = Math.min(Math.max(0, patch.sendHour), 23);
  if (patch.sendMinute !== undefined) clean.sendMinute = Math.min(Math.max(0, patch.sendMinute), 59);
  if (patch.targetRoles !== undefined) {
    const valid = Object.keys(ROLE_SLUGS).filter((k) => patch.targetRoles?.includes(k));
    clean.targetRoles = valid.length > 0 ? valid.join(",") : "SUPERADM";
  }
  if (patch.onlyWeekdays !== undefined) clean.onlyWeekdays = patch.onlyWeekdays;
  if (patch.template !== undefined) clean.template = patch.template?.trim() ?? null;
  if (Object.keys(clean).length > 0) {
    await db.update(waAlertRules).set(clean).where(eq(waAlertRules.id, id));
  }
}

export async function listRecentLogs(limit = 20) {
  const rows = await db.select().from(waAlertsLog).orderBy(desc(waAlertsLog.createdAt)).limit(limit);
  return rows.map((r) => ({
    ruleCode: r.ruleCode,
    recipients: r.recipients ?? "",
    message: r.message ?? "",
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ── Kalkulasi konten tiap aturan ── */
export interface Computed {
  text: string;
  kosong: boolean;
}

const EMPTY: Computed = { text: "", kosong: true };

async function firstBranchWhere(): Promise<string | null> {
  const [b] = await db.select({ id: branches.id }).from(branches).orderBy(asc(branches.createdAt)).limit(1);
  return b?.id ?? null;
}

/** Baris order untuk reminder J-3 (masih aktif) atau terima kasih (terkirim hari ini). */
async function listOrderAlertRows(start: Date, end: Date, delivered = false) {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      shohibul: orders.shohibulName,
      customer: customers.name,
      deliveryDate: orders.deliveryDate,
      status: orders.status,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      delivered
        ? and(gte(orders.updatedAt, start), lte(orders.updatedAt, end), inArray(orders.status, ["DELIVERED", "COMPLETED"]))
        : and(
            gte(orders.deliveryDate, start),
            lte(orders.deliveryDate, end),
            sql`${orders.status} not in ('CANCELLED','DELIVERED','COMPLETED','DRAFT')`
          )
    )
    .orderBy(asc(orders.orderNumber));
  return rows.map((r) => ({
    ...r,
    tanggalKirim: r.deliveryDate
      ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(r.deliveryDate)
      : "-",
  }));
}

export async function computeAlert(code: string): Promise<Computed> {
  const branchId = await firstBranchWhere();
  const now = toJak(new Date());
  const today = now.toISOString().slice(0, 10);
  if (!branchId) return EMPTY;

  if (code === "SCORECARD_BELUM_ISI") {
    const [allDepts, rows] = await Promise.all([
      db.select({ id: departments.id, name: departments.name }).from(departments)
        .where(eq(departments.isActive, true)).orderBy(asc(departments.name)),
      db.select({ departmentId: dailyScorecards.departmentId, date: dailyScorecards.date })
        .from(dailyScorecards)
        .where(and(eq(dailyScorecards.branchId, branchId), eq(dailyScorecards.date, today))),
    ]);
    const have = new Set(rows.map((r) => r.departmentId));
    const missing = allDepts.filter((d) => !have.has(d.id));
    if (missing.length === 0) return EMPTY;
    return { text: missing.map((d) => `• ${d.name}`).join("\n"), kosong: false };
  }

  if (code === "SCORECARD_TAK_TERCAPAI") {
    const lines = await db
      .select({
        dept: departments.name,
        indicator: kpiIndicators.name,
        dir: kpiIndicators.direction,
        target: dailyScorecardLines.targetValue,
        actual: dailyScorecardLines.actualValue,
      })
      .from(dailyScorecardLines)
      .innerJoin(dailyScorecards, eq(dailyScorecardLines.scorecardId, dailyScorecards.id))
      .innerJoin(kpiIndicators, eq(dailyScorecardLines.indicatorId, kpiIndicators.id))
      .innerJoin(departments, eq(dailyScorecards.departmentId, departments.id))
      .where(and(eq(dailyScorecards.branchId, branchId), eq(dailyScorecards.date, today)));
    const bad = lines.filter((l) => {
      const t = Number(l.target);
      const a = Number(l.actual);
      if (t <= 0) return false;
      return l.dir === "LOWER_BETTER" ? a > t : a < t;
    });
    if (bad.length === 0) return EMPTY;
    let txt = bad
      .slice(0, 25)
      .map((b) => `• ${b.dept} — ${b.indicator}: ${Number(b.actual)} dari ${Number(b.target)}`)
      .join("\n");
    if (txt.length > 2400) txt = txt.slice(0, 2400) + " …";
    return { text: txt, kosong: false };
  }

  if (code === "FOLLOWUP_TERLAMBAT") {
    const rows = await db
      .select({
        due: crmActivities.dueAt,
        title: crmActivities.title,
        person: crmPeople.name,
        deal: crmDeals.title,
      })
      .from(crmActivities)
      .leftJoin(crmPeople, eq(crmActivities.personId, crmPeople.id))
      .leftJoin(crmDeals, eq(crmActivities.dealId, crmDeals.id))
      .where(and(isNull(crmActivities.completedAt), lte(crmActivities.dueAt, now)))
      .orderBy(asc(crmActivities.dueAt))
      .limit(15);
    if (rows.length === 0) return EMPTY;
    const txt = rows
      .map(
        (r) =>
          `• ${r.person ?? r.deal ?? "-"} — ${r.title ?? "aktivitas"} (jatuh tempo ${r.due ? r.due.toISOString().slice(5, 10) : "?"})`
      )
      .join("\n");
    return { text: txt, kosong: false };
  }

  if (code === "STOK_MINIM") {
    const rows = await db
      .select({ name: inventoryItems.name, qty: inventoryItems.qty, min: inventoryItems.minQty, unit: inventoryItems.unit })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.isActive, true), lte(inventoryItems.qty, inventoryItems.minQty)))
      .orderBy(asc(inventoryItems.name))
      .limit(25);
    if (rows.length === 0) return EMPTY;
    const txt = rows.map((r) => `• ${r.name}: ${r.qty}/${r.min} ${r.unit}`).join("\n");
    return { text: txt, kosong: false };
  }

  if (code === "ORDER_REMINDER_J3") {
    const target = new Date(now);
    target.setDate(target.getDate() + 3);
    const keyStart = new Date(target.toISOString().slice(0, 10) + "T00:00:00+07:00");
    const keyEnd = new Date(target.toISOString().slice(0, 10) + "T23:59:59+07:00");
    const rows = await listOrderAlertRows(keyStart, keyEnd);
    if (rows.length === 0) return EMPTY;
    const txt = rows
      .slice(0, 25)
      .map((o) => `• ${o.shohibul || o.customer || "-"} — ${o.orderNumber} (kirim ${o.tanggalKirim})`)
      .join("\n");
    return { text: txt, kosong: false };
  }

  if (code === "ORDER_THANKYOU") {
    const todayStart = new Date(today + "T00:00:00+07:00");
    const todayEnd = new Date(today + "T23:59:59+07:00");
    const rows = await listOrderAlertRows(todayStart, todayEnd, true);
    if (rows.length === 0) return EMPTY;
    const txt = rows
      .slice(0, 25)
      .map((o) => `• ${o.shohibul || o.customer || "-"} — ${o.orderNumber}`)
      .join("\n");
    return { text: txt, kosong: false };
  }

  if (code === "ABSENSI_BELUM_LAPOR") {
    const emps = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.branchId, branchId), eq(employees.status, "AKTIF"), isNull(employees.deletedAt)))
      .orderBy(asc(employees.name));
    const present = await db
      .select({ employeeId: attendanceRecords.employeeId })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.date, today));
    const presentSet = new Set(present.map((p) => p.employeeId));
    const missing = emps.filter((e) => !presentSet.has(e.id));
    if (missing.length === 0) return EMPTY;
    return {
      text: missing.slice(0, 25).map((m) => `• ${m.name}`).join("\n"),
      kosong: false,
    };
  }

  return EMPTY;
}

/* ── Distribusi ke panel (lonceng) ── */
async function userIdsByRoleSlugs(slugs: string[]): Promise<string[]> {
  const sl = slugs.map((v) => v.toUpperCase()).filter((v) => ROLE_SLUGS[v]);
  const slugsFinal = Array.from(new Set(sl.flatMap((s) => ROLE_SLUGS[s] ?? [s.toLowerCase()])));
  if (slugsFinal.length === 0) return [];
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(roles.slug, slugsFinal));
  return Array.from(new Set(rows.map((r) => r.userId)));
}

async function pushNotification(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = userIds.map((userId) => ({
    userId,
    channel: "IN_APP" as const,
    title,
    body,
    data,
  }));
  await db.insert(notifications).values(rows);
  return rows.length;
}

function composeMsg(
  rule: { template: string | null },
  code: string,
  textParam: string,
  now: Date
): string {
  const meta = ALERT_RULE_META[code];
  const tanggal = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return renderWhatsappTemplate(rule.template?.trim() || meta?.placeholder || "{daftar}", {
    tanggal,
    daftar: textParam,
  });
}

/** Kirim WA otomatis per order (reminder J-3 / terima kasih). Dedupe per hari via waAlertsLog. */
async function sendOrderCustomerWa(code: string): Promise<string> {
  const branchId = await firstBranchWhere();
  if (!branchId) return "0 terkirim";
  const now = toJak(new Date());
  const today = now.toISOString().slice(0, 10);
  const already = await db
    .select({ id: waAlertsLog.id })
    .from(waAlertsLog)
    .where(and(eq(waAlertsLog.ruleCode, code), gte(waAlertsLog.createdAt, new Date(`${today}T00:00:00+07:00`))))
    .limit(1);
  if (already.length > 0) return "0 terkirim (sudah dikirim hari ini)";

  let rows: Awaited<ReturnType<typeof listOrderAlertRows>> = [];
  if (code === "ORDER_REMINDER_J3") {
    const target = new Date(now);
    target.setDate(target.getDate() + 3);
    rows = await listOrderAlertRows(
      new Date(`${target.toISOString().slice(0, 10)}T00:00:00+07:00`),
      new Date(`${target.toISOString().slice(0, 10)}T23:59:59+07:00`)
    );
  } else {
    rows = await listOrderAlertRows(new Date(`${today}T00:00:00+07:00`), new Date(`${today}T23:59:59+07:00`), true);
  }

  let sent = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const [detail] = await db
      .select({
        phone: orders.recipientPhone,
        name: orders.recipientName,
        deliveryDate: orders.deliveryDate,
        customerId: orders.customerId,
      })
      .from(orders)
      .where(eq(orders.id, row.id))
      .limit(1);
    const phone = (detail?.phone ?? "").trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const nama = detail?.name ?? row.customer ?? row.shohibul ?? "";
    const tanggal = detail?.deliveryDate
      ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(detail.deliveryDate)
      : "";
    try {
      await sendWhatsapp({
        to: phone,
        message:
          code === "ORDER_REMINDER_J3"
            ? `Assalamu'alaikum ${nama}, pengingat pengiriman aqiqah Anda ${tanggal}. Tim Madani Aqiqah siap mentrushkan detail bila ada perubahan. 🙏 – Madani Aqiqah`
            : `Assalamu'alaikum ${nama}, terima kasih 🤍 pesanan aqiqah Anda telah selesai diantarkan. Semoga perayaan aqiqahnya lancar dan menjadi sumber menjadi sufungan. – Madani Aqiqah`,
        kind: "AUTO",
        branchId,
        personId: detail?.customerId ?? null,
        actorId: null,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return failed > 0 ? `${sent} terkirim, ${failed} gagal` : `${sent} terkirim`;
}

/** Jalankan aturan sekarang — terdorong ke panel per user in-app. */
export async function runRuleNow(
  code: string,
  overrideUserIds?: string[],
  opts?: { force?: boolean }
): Promise<{ sent: boolean; skipped?: "disabled" | "empty"; targetCount?: number }> {
  if (code === "ABSENSI_BELUM_LAPOR") return { sent: false, skipped: "disabled" };
  const [rule] = await db.select().from(waAlertRules).where(eq(waAlertRules.code, code)).limit(1);
  if (!rule) return { sent: false, skipped: "disabled" };
  if (!rule.enabled && !opts?.force) return { sent: false, skipped: "disabled" };

  const computed = await computeAlert(code);
  if (computed.kosong) return { sent: false, skipped: "empty" };

  const now = toJak(new Date());

  let waNote = "";
  if (code === "ORDER_REMINDER_J3" || code === "ORDER_THANKYOU") {
    waNote = await sendOrderCustomerWa(code);
  }
  const meta = ALERT_RULE_META[code];
  const title = `⏰ Alarm: ${meta?.label ?? code}`;
  const bodyMsg = composeMsg({ template: rule.template }, code, computed.text, now);

  let userIds: string[];
  if (overrideUserIds && overrideUserIds.length > 0) {
    userIds = overrideUserIds;
  } else {
    const slugs = (rule.targetRoles ?? "SUPERADM").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
    userIds = await userIdsByRoleSlugs(slugs);
  }

  const targetCount = await pushNotification(userIds, title, bodyMsg, {
    ruleCode: code,
    daftar: computed.text,
  });

  await db.insert(waAlertsLog).values({
    ruleCode: code,
    recipients: `${targetCount} user (panel)` + (waNote ? ` · WA: ${waNote}` : ""),
    message: bodyMsg,
    status: targetCount > 0 ? "SENT" : "PARTIAL",
    error: targetCount === 0 ? "Tidak ada user yang cocok" : null,
  });
  await db.update(waAlertRules).set({ lastSentAt: new Date() }).where(eq(waAlertRules.id, rule.id));

  return { sent: true, targetCount };
}

/** Cron per menit: jalankan semua aturan yang sesuai jam (WIB). */
export async function runDueRules(nowInput = new Date()) {
  const now = toJak(nowInput);
  const dow = now.getUTCDay();
  const results: Array<{ code: string; sent: boolean; skipped?: string }> = [];
  const rules = await listRules();
  for (const rule of rules) {
    if (rule.code === "ABSENSI_BELUM_LAPOR") continue; // modul absensi dihide
    if (!rule.enabled) continue;
    if (rule.onlyWeekdays && (dow === 0 || dow === 6)) continue;
    if (rule.sendHour !== now.getUTCHours() || rule.sendMinute !== now.getUTCMinutes()) continue;
    const r = await runRuleNow(rule.code);
    results.push({ code: rule.code, sent: r.sent, skipped: r.skipped });
  }
  return results;
}
