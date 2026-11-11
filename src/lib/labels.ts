/** Label UI untuk enum domain (server & client). */

import { LEAD_STAGE_LABELS } from "@/lib/crm/pipeline";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ORDER_CONFIRMED: "Akad Terkonfirmasi",
  ANIMALS_SIAAP: "Hewan Siap",
  SLAUGHTERED: "Disembelih",
  KARKAS_FILLET: "Karkas / Fillet",
  KITCHEN_COOKED: "Dimasak",
  PACKED: "Dikemas",
  QC_READY: "QC Siap",
  READY_DISPATCH: "Siap Kirim",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const LEAD_STATUS_LABELS: Record<string, string> = LEAD_STAGE_LABELS;

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Referensi",
  ADS: "Iklan",
  SOCIAL: "Sosmed",
  MARKETPLACE: "Marketplace",
  WALK_IN: "Datang Langsung",
  WEB: "Website",
  AFILIATE: "Afiliate",
  AGEN: "Agen",
  WA_BLAST: "WA Blast",
  OTHER: "Lainnya",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Terbit",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
  VOID: "Batal",
  BAD_DEBT: "Macet",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  CONFIRMED: "Terkonfirmasi",
  FAILED: "Gagal",
  REVERSED: "Dibatalkan",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transfer",
  VA: "Virtual Account",
  QRIS: "QRIS",
  EWALLET: "E-Wallet",
  CASH: "Tunai",
  CARD: "Kartu",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  WAITING: "Menunggu",
  PICKED: "Diambil",
  IN_TRANSIT: "Dalam Perjalanan",
  ARRIVED: "Tiba",
  COMPLETE: "Selesai",
};

export const AQIQAH_TYPE_LABELS: Record<string, string> = {
  AKIKAH: "Aqiqah / Akikah",
  TASMIYAH: "Tasmiyah",
  DONASI: "Donasi",
};

export const DELIVERY_TIME_SLOT_LABELS: Record<string, string> = {
  PAGI: "Pagi (09.00–12.00)",
  SIANG: "Siang (12.00–15.00)",
  SORE: "Sore (15.00–18.00)",
  MALAM: "Malam (19.00–21.00)",
};

type BadgeTone = "neutral" | "info" | "gold" | "warning" | "success" | "danger" | "outline";

const ORDER_TONES: Record<string, BadgeTone> = {
  DRAFT: "outline",
  ORDER_CONFIRMED: "info",
  ANIMALS_SIAAP: "info",
  SLAUGHTERED: "neutral",
  KARKAS_FILLET: "neutral",
  KITCHEN_COOKED: "neutral",
  PACKED: "gold",
  QC_READY: "warning",
  READY_DISPATCH: "warning",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const INVOICE_TONES: Record<string, BadgeTone> = {
  DRAFT: "outline",
  ISSUED: "info",
  PARTIAL: "gold",
  PAID: "success",
  VOID: "danger",
  BAD_DEBT: "danger",
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  FAILED: "danger",
  REVERSED: "outline",
};

const LEAD_TONES: Record<string, BadgeTone> = {
  LEAD: "outline",
  CONTACTED: "info",
  INTERESTED: "gold",
  QUOTATION: "warning",
  DP: "success",
  CLOSED: "neutral",
};

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  ACCEPTED: "Disetujui",
  REJECTED: "Ditolak",
  EXPIRED: "Kadaluarsa",
  VOID: "Batal",
};

const QUOTATION_TONES: Record<string, BadgeTone> = {
  DRAFT: "outline",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
  VOID: "outline",
};

export function statusLabel(kind: string, status: string): string {
  switch (kind) {
    case "order":
      return ORDER_STATUS_LABELS[status] ?? status;
    case "lead":
      return LEAD_STATUS_LABELS[status] ?? status;
    case "invoice":
      return INVOICE_STATUS_LABELS[status] ?? status;
    case "payment":
      return PAYMENT_STATUS_LABELS[status] ?? status;
    case "delivery":
      return DELIVERY_STATUS_LABELS[status] ?? status;
    case "quotation":
      return QUOTATION_STATUS_LABELS[status] ?? status;
    default:
      return status;
  }
}

export function badgeTone(kind: string, status: string): BadgeTone {
  switch (kind) {
    case "order":
      return ORDER_TONES[status] ?? "neutral";
    case "lead":
      return LEAD_TONES[status] ?? "neutral";
    case "invoice":
      return INVOICE_TONES[status] ?? "neutral";
    case "payment":
      return PAYMENT_TONES[status] ?? "neutral";
    case "quotation":
      return QUOTATION_TONES[status] ?? "neutral";
    default:
      return "neutral";
  }
}