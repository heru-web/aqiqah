import { z } from "zod";

export const idSchema = z.string().uuid();

/* ------------------------------- CRM/Customer ------------------------------ */

export const customerCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  type: z.enum(["PERUSAHAAN", "PERORANGAN"]).default("PERORANGAN"),
  phone: z.string().max(32).optional(),
  whatsapp: z.string().max(32).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  address: z.string().max(1000).optional(),
  city: z.string().max(80).optional(),
  province: z.string().max(80).optional(),
  npwp: z.string().max(24).optional(),
  source: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  ayahName: z.string().max(160).optional(),
  ibuName: z.string().max(160).optional(),
  birthPlace: z.string().max(120).optional(),
  birthDate: z.string().optional(), // YYYY-MM-DD atau string
  packageName: z.string().max(160).optional(),
  deliveryDate: z.string().optional(), // YYYY-MM-DD atau string
  deliverySlot: z.string().max(40).optional(),
  consent: z.string().max(600).optional(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = customerCreateSchema.partial();

export const leadCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  source: z
    .enum(["REFERRAL", "ADS", "SOCIAL", "MARKETPLACE", "WALK_IN", "WEB", "AFILIATE", "AGEN", "WA_BLAST", "OTHER"])
    .default("WALK_IN"),
  name: z.string().min(2).max(200),
  phone: z.string().max(32).optional(),
  whatsapp: z.string().max(32).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  company: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(255).optional(),
  productInterest: z.string().max(80).optional(),
  budget: z.string().regex(/^\d*$/).max(16).optional().transform((v) => (v ? BigInt(v) : undefined)),
  notes: z.string().max(2000).optional(),
  assignedTo: z.string().uuid().optional(),
  nextFollowupAt: z.coerce.date().optional(),
});
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  customerId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  nextFollowupAt: z.coerce.date().nullable().optional(),
});

export const leadAssignSchema = z.object({
  assignedTo: z.string().uuid().nullable(),
});

export const followupCreateSchema = z.object({
  leadId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  method: z.enum(["WA", "CALL", "MEETING", "EMAIL"]),
  summary: z.string().max(2000).optional(),
  dueAt: z.coerce.date().optional(),
});
export type FollowupCreateInput = z.infer<typeof followupCreateSchema>;

/* ------------------------------ Product/Item ------------------------------- */

export const lineItemSchema = z.object({
  kind: z.enum(["PAKET", "PRODUK", "ANIMAL", "SERVICE"]),
  entityId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  description: z.string().max(500),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.string().regex(/^\d*$/).max(20).transform((v) => BigInt(v || "0")),
  discountBps: z.number().int().min(0).max(10000).default(0),
  isFree: z.boolean().default(false),
});
export type LineItemInput = z.infer<typeof lineItemSchema>;

export const productCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1).max(40),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  type: z.enum(["PRODUK_OLAH", "PAKET"]).default("PRODUK_OLAH"),
  unit: z.enum(["EKOR", "KG", "BOX", "PORSI", "PAKET"]).default("PAKET"),
  unitWeightGr: z.number().int().positive().optional(),
  salePrice: z.string().regex(/^\d*$/).max(20).transform((v) => BigInt(v || "0")),
  hppBasis: z.string().regex(/^\d*$/).max(20).transform((v) => BigInt(v || "0")),
  description: z.string().max(2000).optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const packageCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  discountBps: z.number().int().min(0).max(10000).default(0),
  items: z.array(lineItemSchema).min(1).max(50),
});
export type PackageCreateInput = z.infer<typeof packageCreateSchema>;

/* ------------------------------- Quotation -------------------------------- */

export const quotationCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(lineItemSchema).min(1).max(50),
  shippingAmount: z.string().regex(/^\d*$/).max(20).default("0").transform((v) => BigInt(v || "0")),
  voucherCode: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
});
export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;
/** Tipe input mentah (tanggal/uang string). */
export type QuotationCreateRawInput = z.input<typeof quotationCreateSchema>;

/* --------------------------------- Order ---------------------------------- */

export const orderCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  aqiqahType: z.enum(["AKIKAH", "TASMIYAH", "DONASI"]).default("AKIKAH"),
  shohibulName: z.string().max(200).optional(),
  shohibulGender: z.enum(["L", "P"]).optional(),
  childName: z.string().max(200).optional(),
  bornDate: z.coerce.date().optional(),
  aqiqahDay: z.number().int().min(1).max(21).optional(),
  aqiqahDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  deliveryTimeSlot: z.string().max(40).optional(),
  recipientName: z.string().max(200).optional(),
  recipientPhone: z.string().max(32).optional(),
  deliveryAddress: z.string().max(1000).optional(),
  deliveryCity: z.string().max(80).optional(),
  deliveryDistrict: z.string().max(80).optional(),
  deliveryLandmark: z.string().max(500).optional(),
  gpsCoordinates: z.string().max(80).optional(),
  deliveryNote: z.string().max(1000).optional(),
  items: z.array(lineItemSchema).min(1).max(50),
  shippingAmount: z.string().regex(/^\d*$/).max(20).default("0").transform((v) => BigInt(v || "0")),
  voucherCode: z.string().max(40).optional(),
  channel: z.string().max(40).optional(),
  referralSource: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  expectedTotal: z.string().regex(/^\d+$/).max(20).transform(BigInt).optional(),
  confirmImmediately: z.boolean().default(false),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
/** Tipe input mentah (tanggal/uang string) untuk server action dari client. */
export type OrderCreateRawInput = z.input<typeof orderCreateSchema>;

export const orderTransitionSchema = z.object({
  orderId: z.string().uuid(),
  toStatus: z.enum([
    "ORDER_CONFIRMED",
    "ANIMALS_SIAAP",
    "SLAUGHTERED",
    "KARKAS_FILLET",
    "KITCHEN_COOKED",
    "PACKED",
    "QC_READY",
    "READY_DISPATCH",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ]),
  reason: z.string().max(500).optional(),
});
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

/* --------------------------- Invoice / Payment ----------------------------- */

export const paymentConfirmSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(["CONFIRMED", "FAILED"]),
  notes: z.string().max(1000).optional(),
});
export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;

export const paymentRegisterSchema = z.object({
  branchId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  amount: z.string().regex(/^\d*$/).max(20).transform((v) => BigInt(v || "0")),
  method: z.enum(["TRANSFER", "VA", "QRIS", "EWALLET", "CASH", "CARD"]),
  provider: z.string().max(40).optional(),
  providerRef: z.string().max(160).optional(),
  bankFrom: z.string().max(80).optional(),
  bankTo: z.string().max(80).optional(),
  senderName: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  confirmNow: z.boolean().default(false),
});
export type PaymentRegisterInput = z.infer<typeof paymentRegisterSchema>;
/** Tipe input mentah (sebelum transformasi uang string→bigint). */
export type PaymentRegisterRawInput = z.input<typeof paymentRegisterSchema>;

/* ------------------------------ RBAC / Branch ------------------------------ */

export const userCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  email: z.string().email().max(255),
  name: z.string().min(2).max(160),
  password: z.string().min(8).max(128),
  phone: z.string().max(32).optional(),
  roleIds: z.array(z.string().uuid()).default([]),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).max(160).optional(),
  phone: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const roleCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  permissions: z.array(z.string().max(120)),
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = roleCreateSchema.partial();

export const branchCreateSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(2).max(160),
  ownerName: z.string().max(160).optional(),
  address: z.string().max(1000).optional(),
  city: z.string().max(80).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  igHandle: z.string().max(80).optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;

export const settingsUpdateSchema = z.record(z.string(), z.unknown());

/* ------------------------------ Webhook BSI -------------------------------- */

export const bsiVaCallbackSchema = z.object({
  amount: z.string().or(z.number()).or(z.bigint().optional()),
  reference: z.string().min(1),
  vaNumber: z.string().optional(),
  status: z.enum(["PAID", "PENDING", "FAILED"]),
  paidAt: z.string().datetime().optional().or(z.coerce.date()),
  transactionId: z.string().optional(),
  customerName: z.string().optional(),
});
export type BsiVaCallbackInput = z.infer<typeof bsiVaCallbackSchema>;