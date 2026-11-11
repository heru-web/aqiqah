/**
 * Definisi pipeline CRM yang murni (tanpa import server/DB) sehingga dapat
 * dipakai bersama oleh service, server action, dan komponen client.
 *
 * Acuan pola: Twenty & Frappe CRM (record-centric pipeline + stage machine).
 */

export const LEAD_STAGES = [
  "LEAD",
  "CONTACTED",
  "INTERESTED",
  "QUOTATION",
  "DP",
  "CLOSED",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export interface LeadStageMeta {
  label: string;
  description: string;
  /** Warna titik indikator pada board & stepper. */
  dotClass: string;
  /** Warna lembut untuk kolom kanban. */
  columnClass: string;
}

export const LEAD_STAGE_META: Record<LeadStage, LeadStageMeta> = {
  LEAD: {
    label: "Lead Baru",
    description: "Prospek masuk, belum dihubungi.",
    dotClass: "bg-muted-foreground",
    columnClass: "bg-surface/40",
  },
  CONTACTED: {
    label: "Dihubungi",
    description: "Sudah ada kontak pertama.",
    dotClass: "bg-info",
    columnClass: "bg-info-soft/30",
  },
  INTERESTED: {
    label: "Minat",
    description: "Tertarik, masih pertimbangan.",
    dotClass: "bg-gold",
    columnClass: "bg-gold-soft/30",
  },
  QUOTATION: {
    label: "Penawaran",
    description: "Penawaran sudah dikirim.",
    dotClass: "bg-warning",
    columnClass: "bg-warning-soft/30",
  },
  DP: {
    label: "DP Masuk",
    description: "Komitmen DP diterima.",
    dotClass: "bg-success",
    columnClass: "bg-success-soft/30",
  },
  CLOSED: {
    label: "Selesai",
    description: "Prospek selesai / ditutup.",
    dotClass: "bg-primary",
    columnClass: "bg-primary/10",
  },
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = Object.fromEntries(
  LEAD_STAGES.map((stage) => [stage, LEAD_STAGE_META[stage].label])
) as Record<LeadStage, string>;

/** Transisi yang diizinkan oleh state machine. Tidak boleh mundur sembarangan. */
const LEAD_TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  LEAD: ["CONTACTED", "INTERESTED", "QUOTATION", "DP", "CLOSED"],
  CONTACTED: ["INTERESTED", "QUOTATION", "DP", "CLOSED"],
  INTERESTED: ["QUOTATION", "DP", "CLOSED"],
  QUOTATION: ["DP", "INTERESTED", "CLOSED"],
  DP: ["CLOSED", "QUOTATION"],
  CLOSED: [],
};

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

export function canTransitionLead(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return false;
  return LEAD_TRANSITIONS[from].includes(to);
}

export function allowedLeadTransitions(from: LeadStage): LeadStage[] {
  return [...LEAD_TRANSITIONS[from]];
}

/** Tahap linear berikutnya (untuk tombol "Majukan"). */
export function nextLeadStage(from: LeadStage): LeadStage | null {
  const index = LEAD_STAGES.indexOf(from);
  if (index < 0 || index >= LEAD_STAGES.length - 1) return null;
  return LEAD_STAGES[index + 1];
}

export function leadStageIndex(stage: LeadStage): number {
  return LEAD_STAGES.indexOf(stage);
}

export function isLeadClosed(stage: LeadStage): boolean {
  return stage === "CLOSED";
}

export function leadProgressPercent(stage: LeadStage): number {
  const index = leadStageIndex(stage);
  if (index < 0) return 0;
  return Math.round((index / (LEAD_STAGES.length - 1)) * 100);
}

export function leadStageLabel(stage: string): string {
  return isLeadStage(stage) ? LEAD_STAGE_META[stage].label : stage;
}

/* --------------------------------- Filter --------------------------------- */

export type LeadDueFilter = "ALL" | "OVERDUE" | "TODAY" | "WEEK" | "NONE";

export const LEAD_DUE_FILTER_LABELS: Record<LeadDueFilter, string> = {
  ALL: "Semua jadwal",
  OVERDUE: "Terlambat",
  TODAY: "Hari ini",
  WEEK: "7 hari ke depan",
  NONE: "Tanpa follow-up",
};

export function isLeadDueFilter(value: string): value is LeadDueFilter {
  return value in LEAD_DUE_FILTER_LABELS;
}

/* ------------------------------- Due state -------------------------------- */

export type LeadDueState = "NONE" | "OVERDUE" | "TODAY" | "SOON" | "LATER";

export function leadDueState(due: Date | string | null | undefined, now = new Date()): LeadDueState {
  if (!due) return "NONE";
  const date = typeof due === "string" ? new Date(due) : due;
  if (Number.isNaN(date.getTime())) return "NONE";

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);

  if (date < now) return "OVERDUE";
  if (date < endToday) return "TODAY";
  if (date < endWeek) return "SOON";
  return "LATER";
}

export const LEAD_DUE_STATE_LABELS: Record<LeadDueState, string> = {
  NONE: "Tanpa jadwal",
  OVERDUE: "Terlambat",
  TODAY: "Hari ini",
  SOON: "Minggu ini",
  LATER: "Terjadwal",
};
