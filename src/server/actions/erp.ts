"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { imageFormat } from "@/lib/image-upload";
import { parseIDR } from "@/lib/money";
import { requirePermission } from "@/lib/server/auth";
import { getStorage, objectKey } from "@/lib/server/storage";
import { sendWhatsapp } from "@/server/services/whatsapp";
import {
  adjustStock,
  advanceProdStage,
  createDeliveryTask,
  createProductionBatch,
  ensureDeliveryTrackingToken,
  getBatchWaContext,
  getTaskWaContext,
  recordDeliveryPod,
  setDeliveryStatus,
  setProdQc,
  changeKasbonStatus,
  createInventoryItem,
  createKasbon,
  createPayrollRun,
  createZiswaf,
  deleteInventoryItems,
  finalizePayrollRun,
  updateInventoryItem,
  updatePayrollLine,
} from "@/server/services/erp";

/* ── Lacak pesanan ── */
export async function getDeliveryTrackingLinkAction(taskId: string): Promise<{ path?: string; error?: string }> {
  try {
    const actor = await requirePermission("delivery.deliveries.view");
  await assertResourceAccess("delivery", taskId, actor);
    const token = await ensureDeliveryTrackingToken(taskId);
    if (!token) return { error: "Tugas pengiriman tidak ditemukan." };
    revalidatePath("/delivery");
    return { path: `/lacak/${token}` };
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal membuat link lacak." };
  }
}

/* ── Inventaris ── */
export async function createInventoryItemAction(fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.stock.create");
  try {
    await createInventoryItem(
      {
        name: String(fd.get("name") ?? "").trim(),
        category: String(fd.get("category") ?? "BAHAN").trim(),
        unit: String(fd.get("unit") ?? "buah").trim(),
        qty: Number(fd.get("qty") ?? 0),
        minQty: Number(fd.get("minQty") ?? 0),
        location: String(fd.get("location") ?? "").trim() || undefined,
        notes: String(fd.get("notes") ?? "").trim() || undefined,
        unitCost: parseIDR(String(fd.get("unitCost") ?? "") || "0"),
      },
      actor.branchId ?? "",
      actor.id
    );
    revalidatePath("/inventory");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan item." };
  }
}

export async function updateInventoryItemAction(id: string, fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.stock.update");
  await assertResourceAccess("inventory", id, actor);
  try {
    await updateInventoryItem(id, {
      name: String(fd.get("name") ?? "").trim() || undefined,
      category: String(fd.get("category") ?? "").trim() || undefined,
      unit: String(fd.get("unit") ?? "").trim() || undefined,
      minQty: fd.get("minQty") ? Number(fd.get("minQty")) : undefined,
      location: String(fd.get("location") ?? "").trim() || undefined,
      notes: String(fd.get("notes") ?? "").trim() || undefined,
      isActive: fd.get("isActive") === "true" ? true : fd.get("isActive") === "false" ? false : undefined,
    });
    revalidatePath("/inventory");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal memperbarui item." };
  }
}

export async function adjustStockAction(itemId: string, direction: "IN" | "OUT" | "ADJUST", qty: number, reason: string, unitCostRaw = "0"): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.adjustment.create");
  await assertResourceAccess("inventory", itemId, actor);
  try {
    await adjustStock(itemId, direction, qty, reason, actor.id, parseIDR(unitCostRaw || "0"));
    revalidatePath("/inventory");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyesuaikan stok." };
  }
}


export async function adjustStockFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("inventory.adjustment.create");
  await assertResourceAccess("inventory", String(fd.get("itemId") ?? ""), actor);
  try {
    const itemId = String(fd.get("itemId") ?? "");
    const direction = (String(fd.get("direction") ?? "IN").trim().toUpperCase() || "IN") as "IN" | "OUT" | "ADJUST";
    const qty = Number(fd.get("qty") ?? 0);
    const reason = String(fd.get("reason") ?? "").trim() || "Penyesuaian stok";
    const unitCost = parseIDR(String(fd.get("unitCost") ?? "") || "0");
    if (!itemId) return { error: "Pilih item stok." };
    await adjustStock(itemId, direction, qty, reason, actor.id, unitCost);
    revalidatePath("/inventory");
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}

export async function setItemActiveFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("inventory.stock.update");
  await assertResourceAccess("inventory", String(fd.get("itemId") ?? ""), actor);
  try {
    const id = String(fd.get("itemId") ?? "");
    const active = String(fd.get("active") ?? "") === "1";
    await updateInventoryItem(id, { isActive: active });
    revalidatePath("/inventory");
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}

export async function deleteInventoryItemsAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.stock.delete");
  for (const id of ids) await assertResourceAccess("inventory", id, actor);
  try {
    await deleteInventoryItems(ids);
    revalidatePath("/inventory");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menghapus item." };
  }
}

/* ── Payroll ── */
export async function createPayrollRunAction(period: string): Promise<{ error?: string; runId?: string }> {
  const actor = await requirePermission("payroll.payroll.create");
  try {
    if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Format periode harus YYYY-MM." };
    const runId = await createPayrollRun(period, actor.branchId ?? "", actor.id);
    revalidatePath("/payroll");
    return { runId };
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal membuat payroll run." };
  }
}

export async function updatePayrollLineAction(id: string, fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("payroll.payroll.update");
  try {
    const allowance = fd.get("allowance") ? BigInt(String(fd.get("allowance"))) : undefined;
    const deduction = fd.get("deduction") ? BigInt(String(fd.get("deduction"))) : undefined;
    const note = String(fd.get("note") ?? "").trim() || undefined;
    await updatePayrollLine(id, { allowance, deduction, note }, actor);
    revalidatePath("/payroll");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal memperbarui baris." };
  }
}

export async function finalizePayrollRunAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("payroll.payroll.action");
  await assertResourceAccess("payroll", id, actor);
  try {
    await finalizePayrollRun(id, actor);
    revalidatePath("/payroll");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal finalisasi." };
  }
}

/* ── Kasbon ── */
export async function createKasbonAction(fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("kasbon.kasbon.create");
  try {
    if (String(fd.get("employeeId") ?? "")) await assertResourceAccess("employee", String(fd.get("employeeId") ?? "") as string, actor);
    const amount = BigInt(String(fd.get("amount") ?? "0"));
    if (amount <= 0n) return { error: "Nominal harus lebih dari 0." };
    await createKasbon(
      {
        employeeId: String(fd.get("employeeId") ?? ""),
        amount,
        reason: String(fd.get("reason") ?? "").trim() || undefined,
      },
      actor.branchId ?? "",
      actor.id
    );
    revalidatePath("/kasbon");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengajukan kasbon." };
  }
}

export async function changeKasbonStatusAction(id: string, status: "DISETUJUI" | "DIBAYAR" | "DIBATALKAN"): Promise<{ error?: string }> {
  const actor = await requirePermission("kasbon.kasbon.action");
  await assertResourceAccess("kasbon", id, actor);
  try {
    await changeKasbonStatus(id, status, actor);
    revalidatePath("/kasbon");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengubah status." };
  }
}

/* ── ZISWAF ── */
export async function createZiswafAction(fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("ziswaf.ziswaf.create");
  try {
    const amount = BigInt(String(fd.get("amount") ?? "0"));
    if (amount <= 0n) return { error: "Nominal harus lebih dari 0." };
    await createZiswaf(
      {
        kind: (String(fd.get("kind") ?? "ZAKAT").trim().toUpperCase() || "ZAKAT") as "ZAKAT",
        direction: (String(fd.get("direction") ?? "IN").trim().toUpperCase() || "IN") as "IN",
        amount,
        party: String(fd.get("party") ?? "").trim(),
        eventDate: fd.get("eventDate") ? new Date(String(fd.get("eventDate"))) : undefined,
        note: String(fd.get("note") ?? "").trim() || undefined,
      },
      actor.branchId ?? "",
      actor.id
    );
    revalidatePath("/ziswaf");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan entri ZISWAF." };
  }
}

/* ── Wrapper void untuk <form action={...}> (harus () => void|Promise<void>) ── */
export async function createInventoryItemVoidAction(fd: FormData): Promise<{ error?: string }> { return createInventoryItemAction(fd); }
export async function createPayrollRunVoidAction(fd: FormData): Promise<{ error?: string }> { return createPayrollRunAction(String(fd.get("period") ?? "")); }
export async function finalizePayrollRunVoidAction(fd: FormData): Promise<{ error?: string }> { return finalizePayrollRunAction(String(fd.get("runId") ?? "")); }
export async function updatePayrollLineVoidAction(fd: FormData): Promise<{ error?: string }> { return updatePayrollLineAction(String(fd.get("id") ?? ""), fd); }
export async function createKasbonVoidAction(fd: FormData): Promise<{ error?: string }> { return createKasbonAction(fd); }
export async function changeKasbonStatusVoidAction(fd: FormData): Promise<{ error?: string }> {
  const status = String(fd.get("status") ?? "") as "DISETUJUI" | "DIBAYAR" | "DIBATALKAN";
  return changeKasbonStatusAction(String(fd.get("id") ?? ""), status);
}
export async function createZiswafVoidAction(fd: FormData): Promise<{ error?: string }> { return createZiswafAction(fd); }

export async function createProductionBatchVoidAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("production.batches.create");
  try {
    if (String(fd.get("inventoryItemId") ?? "")) await assertResourceAccess("inventory", String(fd.get("inventoryItemId") ?? "") as string, actor);
    const itemName = String(fd.get("itemName") ?? "").trim();
    const qtyPlanned = Number(fd.get("qtyPlanned") ?? 0);
    if (!itemName || !Number.isSafeInteger(qtyPlanned) || qtyPlanned <= 0) return { error: "Nama dan jumlah batch wajib valid." };
    await createProductionBatch(
      {
        itemName,
        qtyPlanned,
        inventoryItemId: String(fd.get("inventoryItemId") ?? "").trim() || undefined,
        notes: String(fd.get("notes") ?? "").trim() || undefined,
      },
      actor.branchId ?? "",
      actor.id
    );
    revalidatePath("/production");
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}
export async function advanceProdStageFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("production.batches.update");
  await assertResourceAccess("production", String(fd.get("id") ?? ""), actor);
  try { await advanceProdStage(String(fd.get("id") ?? ""), actor); revalidatePath("/production"); revalidatePath("/m/rph"); } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}
export async function setProdQcFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("production.qc.update");
  await assertResourceAccess("production", String(fd.get("id") ?? ""), actor);
  try {
    const qc = String(fd.get("qc") ?? "") as "PASS" | "FAIL";
    if (qc === "PASS" || qc === "FAIL") {
      await setProdQc(String(fd.get("id") ?? ""), qc);
      revalidatePath("/production");
      revalidatePath("/m/rph");
    }
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}
export async function createDeliveryVoidAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("delivery.deliveries.create");
  try {
    const destination = String(fd.get("destination") ?? "").trim();
    if (!destination) return { error: "Tujuan wajib diisi." };
    const sched = String(fd.get("scheduledAt") ?? "").trim();
    await createDeliveryTask(
      {
        destination,
        contactName: String(fd.get("contactName") ?? "").trim() || undefined,
        contactPhone: String(fd.get("contactPhone") ?? "").trim() || undefined,
        driverName: String(fd.get("driverName") ?? "").trim() || undefined,
        vehiclePlate: String(fd.get("vehiclePlate") ?? "").trim() || undefined,
        scheduledAt: sched && !Number.isNaN(new Date(sched).getTime()) ? new Date(sched) : undefined,
        notes: String(fd.get("notes") ?? "").trim() || undefined,
      },
      actor.branchId ?? "",
      actor.id
    );
    revalidatePath("/delivery");
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}
export async function setDeliveryStatusFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("delivery.deliveries.update");
  await assertResourceAccess("delivery", String(fd.get("id") ?? ""), actor);
  try {
    const status = String(fd.get("status") ?? "") as "WAITING" | "IN_TRANSIT" | "ARRIVED" | "GAGAL";
    if (["WAITING", "IN_TRANSIT", "ARRIVED", "GAGAL"].includes(status)) {
      await setDeliveryStatus(String(fd.get("id") ?? ""), status, actor);
      revalidatePath("/delivery");
      revalidatePath("/m/kurir");
    }
  } catch (err) { return { error: AppError.is(err) ? err.message : "Perubahan gagal disimpan." }; }
}

/* ── Mobile Ops: RPH & POD ── */

const STAGE_LABEL: Record<string, string> = {
  RPH: "RPH (sembelih)",
  POTONG: "Potong",
  MASAK: "Masak",
  PACKING: "Packing",
  QC: "QC",
  SIAP: "Siap",
};

export async function sendBatchWaAction(fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("production.batches.action");
  await assertResourceAccess("production", String(fd.get("id") ?? ""), actor);
  try {
    const id = String(fd.get("id") ?? "");
    const link = String(fd.get("link") ?? "").trim();
    const ctx = await getBatchWaContext(id);
    if (!ctx || !ctx.orderNumber) return { error: "Batch belum terhubung ke pesanan." };
    const phone = ctx.recipientPhone ?? ctx.customerPhone;
    if (!phone) return { error: "Nomor WhatsApp shohibul tidak tersedia." };
    const label = STAGE_LABEL[ctx.stage] ?? ctx.stage;
    const lines = [
      "Assalamu'alaikum wr wb.",
      `Update pesanan aqiqah #${ctx.orderNumber}${ctx.childName ? ` — anak ${ctx.childName}` : ctx.customerName ? ` (${ctx.customerName})` : ""}`,
      `Alhamdulillah, tahap penyiapan masuk tahap berikutnya: ${label}.`,
    ];
    if (link) lines.push(`Bukti: ${link}`);
    lines.push("Barakallahu laka, terima kasih mempercayakan ibadah aqiqah kepada MADANI AQIQAH & CATERING.");
    const res = await sendWhatsapp({ to: phone, message: lines.join("\n"), kind: "AUTO", actorId: actor.id, branchId: actor.branchId });
    if (!res.ok) return { error: "Gateway WA tidak mengonfirmasi pengiriman." };
    revalidatePath("/m/rph");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengirim WhatsApp." };
  }
}

const MAX_FILE_MB = 6;

async function putPodFile(file: File | null, fallback: string): Promise<string> {
  if (!file || file.size === 0) return "";
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new AppError("VALIDATION_ERROR", `${fallback} lebih dari ${MAX_FILE_MB} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const format = imageFormat(buf);
  const key = objectKey("pod", `bukti.${format.extension}`);
  await getStorage().put(key, buf, format.mime);
  return key;
}

export async function savePodAction(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const actor = await requirePermission("delivery.deliveries.update");
  await assertResourceAccess("delivery", String(fd.get("taskId") ?? ""), actor);
  try {
    const taskId = String(fd.get("taskId") ?? "");
    if (!taskId) return { error: "Tugas tidak ditemukan." };

    const geo = String(fd.get("podGeo") ?? "").trim();
    const coords = geo.split(",").map(Number);
    if (coords.length !== 2 || !geo || coords.some((n) => !Number.isFinite(n)) || Math.abs(coords[0]) > 90 || Math.abs(coords[1]) > 180) return { error: "Ambil lokasi GPS yang valid terlebih dahulu." };
    const photoFile = fd.get("podPhoto");
    const sigFile = fd.get("podSignature");
    const photoKey = photoFile instanceof File
      ? await putPodFile(photoFile, "foto-tiba.png")
      : "";
    const sigKey = sigFile instanceof File
      ? await putPodFile(sigFile, "ttd.png")
      : "";
    if (!photoKey && !sigKey) return { error: "Mohon isi minimal foto bukti atau tanda tangan." };


    const recipientName = String(fd.get("recipientName") ?? "").trim();
    const tempRaw = String(fd.get("podTemp") ?? "").trim();
    const notes = String(fd.get("podNotes") ?? "").trim();
    const checklist = fd.getAll("podChecklist").map((c) => String(c)).filter(Boolean);

    await recordDeliveryPod(taskId, {
      recipientName: recipientName || undefined,
      photoUrl: photoKey || undefined,
      signatureUrl: sigKey || undefined,
      tempC: tempRaw ? Number(tempRaw) : undefined,
      geo: geo,
      checklist: checklist,
      notes: notes || undefined,
    }, actor);

    const task = await getTaskWaContext(taskId);
    const phone = task?.contactPhone ?? task?.recipientPhone ?? task?.customerPhone;
    if (phone) {
      try {
        const lines = [
          "Alhamdulillah Barakallah…",
          task.orderNumber ? `Paket aqiqah #${task.orderNumber} telah tiba di tujuan.` : "Paket aqiqah telah tiba di tujuan.",
          recipientName ? `Diterima oleh: ${recipientName}.` : "",
          "Semoga menjadi pembuka pintu keberkahan bagi keluarga Anda.",
        ].filter(Boolean);
        await sendWhatsapp({ to: phone, message: lines.join("\n"), kind: "AUTO", actorId: actor.id, branchId: actor.branchId });
      } catch (e) {
        console.error("[pod] WA tiba gagal", e);
      }
    }

    revalidatePath("/m/kurir");
    revalidatePath("/delivery");
    return { ok: true };
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan POD." };
  }
}

export async function sendBatchWaVoidAction(fd: FormData): Promise<{ error?: string }> {
  return sendBatchWaAction(fd);
}
