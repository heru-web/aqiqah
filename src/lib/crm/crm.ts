import type { CrmActivityType, CrmStageType } from "@/server/services/crm";

export const CRM_STAGE_COLORS = [
  "slate",
  "blue",
  "amber",
  "violet",
  "emerald",
  "rose",
  "cyan",
  "orange",
] as const;

export type CrmStageColor = (typeof CRM_STAGE_COLORS)[number];

export const STAGE_COLOR_CLASS: Record<
  string,
  { dot: string; soft: string; text: string; border: string; bar: string }
> = {
  slate: {
    dot: "bg-muted-foreground",
    soft: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-line/15",
    bar: "bg-muted-foreground",
  },
  blue: {
    dot: "bg-info",
    soft: "bg-info-soft/40",
    text: "text-info-soft-foreground",
    border: "border-info/20",
    bar: "bg-info",
  },
  amber: {
    dot: "bg-warning",
    soft: "bg-warning-soft/40",
    text: "text-warning-soft-foreground",
    border: "border-warning/20",
    bar: "bg-warning",
  },
  violet: {
    dot: "bg-primary",
    soft: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    bar: "bg-primary",
  },
  emerald: {
    dot: "bg-success",
    soft: "bg-success-soft/40",
    text: "text-success-soft-foreground",
    border: "border-success/20",
    bar: "bg-success",
  },
  rose: {
    dot: "bg-danger",
    soft: "bg-danger-soft/40",
    text: "text-danger-soft-foreground",
    border: "border-danger/20",
    bar: "bg-danger",
  },
  cyan: {
    dot: "bg-info",
    soft: "bg-info-soft/30",
    text: "text-info-soft-foreground",
    border: "border-info/20",
    bar: "bg-info",
  },
  orange: {
    dot: "bg-gold",
    soft: "bg-gold-soft/40",
    text: "text-gold-soft-foreground",
    border: "border-gold/20",
    bar: "bg-gold",
  },
};

export function stageColorClasses(color: string | null | undefined) {
  return STAGE_COLOR_CLASS[color ?? "slate"] ?? STAGE_COLOR_CLASS.slate;
}

export const ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  CALL: "Telepon",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  TASK: "Tugas",
};

export const STAGE_TYPE_LABELS: Record<CrmStageType, string> = {
  OPEN: "Berjalan",
  WON: "Jadi pesanan",
  LOST: "Batal",
};

export type CrmDueState = "NONE" | "OVERDUE" | "TODAY" | "SOON" | "LATER" | "DONE";

export function crmDueState(due: Date | string | null | undefined, completedAt?: Date | string | null): CrmDueState {
  if (completedAt) return "DONE";
  if (!due) return "NONE";
  const date = typeof due === "string" ? new Date(due) : due;
  if (Number.isNaN(date.getTime())) return "NONE";
  const now = new Date();
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

export const CRM_DUE_LABELS: Record<CrmDueState, string> = {
  NONE: "Tanpa jadwal",
  OVERDUE: "Terlambat",
  TODAY: "Hari ini",
  SOON: "Minggu ini",
  LATER: "Terjadwal",
  DONE: "Selesai",
};

export const CRM_PRODUCT_OPTIONS = [
  { value: "kambing", label: "Kambing" },
  { value: "sapi", label: "Sapi" },
  { value: "paket", label: "Paket Olahan" },
  { value: "pesanan_olah", label: "Pesanan Olahan" },
];
