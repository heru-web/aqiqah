import { InvalidOperationError, ValidationError } from "@/lib/errors";

export function validateStockMove(direction: string, qty: number, unitCost = 0n): void {
  if (!["IN", "OUT", "ADJUST"].includes(direction)) throw new ValidationError("Jenis mutasi stok tidak valid.");
  if (!Number.isSafeInteger(qty) || qty < 0 || (direction !== "ADJUST" && qty === 0)) {
    throw new ValidationError("Jumlah stok harus bilangan bulat positif; penyesuaian boleh nol.");
  }
  if (unitCost < 0n) throw new ValidationError("Harga satuan tidak boleh negatif.");
}

export function requirePassingQc(stage: string, qc: string): void {
  if (stage === "QC" && qc !== "PASS") throw new InvalidOperationError("QC harus lolos sebelum batch dinyatakan siap.");
}

export function payrollNet(status: string, basic: bigint, allowance: bigint, deduction: bigint): bigint {
  if (status !== "DRAFT") throw new InvalidOperationError("Payroll final tidak dapat diubah.");
  if (allowance < 0n || deduction < 0n || basic + allowance - deduction < 0n) {
    throw new ValidationError("Komponen gaji dan gaji bersih tidak boleh negatif.");
  }
  return basic + allowance - deduction;
}

export function validateDeliveryTransition(from: string, to: string, orderStatus?: string): void {
  if (orderStatus === "CANCELLED") throw new InvalidOperationError("Pesanan dibatalkan; pengiriman tidak dapat diproses.");
  const transitions: Record<string, string[]> = {
    WAITING: ["IN_TRANSIT", "GAGAL"], IN_TRANSIT: ["ARRIVED", "GAGAL"], GAGAL: ["WAITING"], ARRIVED: [],
  };
  if (from !== to && !transitions[from]?.includes(to)) throw new InvalidOperationError("Transisi pengiriman tidak diizinkan.");
}
