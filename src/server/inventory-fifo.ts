/**
 * Engine FIFO persediaan — murni (tanpa DB), mudah diuji.
 * Lot tertua (receivedAt terkecil, lalu id) dikonsumsi lebih dulu.
 */

export interface FifoLot {
  id: string;
  qtyRemaining: number;
  unitCost: bigint;
  receivedAt: Date;
}

export interface FifoAllocation {
  lotId: string;
  qty: number;
  totalCost: bigint;
}

export interface FifoPlan {
  allocations: FifoAllocation[];
  totalCost: bigint;
  shortage: number;
}

/** Rencakan konsumsi quantity dari daftar lot tanpa memutasi input. */
export function planFifoConsumption(lots: FifoLot[], qty: number): FifoPlan {
  const need = Math.max(0, Math.trunc(qty));
  const sorted = [...lots].sort((a, b) => {
    const t = a.receivedAt.getTime() - b.receivedAt.getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });

  let remaining = need;
  let totalCost = 0n;
  const allocations: FifoAllocation[] = [];

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qtyRemaining, remaining);
    if (take <= 0) continue;
    const lotCost = lot.unitCost * BigInt(take);
    allocations.push({ lotId: lot.id, qty: take, totalCost: lotCost });
    totalCost += lotCost;
    remaining -= take;
  }

  return { allocations, totalCost, shortage: remaining };
}

/** Nilai stok semua lot tersisa (HPP nilai persediaan). */
export function fifoStockValue(lots: FifoLot[]): bigint {
  let value = 0n;
  for (const lot of lots) {
    if (lot.qtyRemaining > 0) value += lot.unitCost * BigInt(lot.qtyRemaining);
  }
  return value;
}
