import { describe, expect, it } from "vitest";
import { fifoStockValue, planFifoConsumption, type FifoLot } from "@/server/inventory-fifo";

const lot = (id: string, qtyRemaining: number, unitCost: bigint, receivedAt: string): FifoLot => ({
  id,
  qtyRemaining,
  unitCost,
  receivedAt: new Date(receivedAt),
});

describe("FIFO konsumsi stok & HPP", () => {
  it("mengambil lot tertua lebih dulu", () => {
    const lots = [
      lot("b", 5, 7_000n, "2026-01-02T00:00:00Z"),
      lot("a", 10, 5_000n, "2026-01-01T00:00:00Z"),
    ];
    const plan = planFifoConsumption(lots, 4);
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0]).toMatchObject({ lotId: "a", qty: 4, totalCost: 20_000n });
    expect(plan.totalCost).toBe(20_000n);
    expect(plan.shortage).toBe(0);
  });

  it("melintasi multi-lot dan menghitung HPP total", () => {
    const plan = planFifoConsumption([lot("a", 3, 5_000n, "2026-01-01T00:00:00Z"), lot("b", 10, 6_000n, "2026-01-02T00:00:00Z")], 7);
    expect(plan.allocations).toEqual([
      { lotId: "a", qty: 3, totalCost: 15_000n },
      { lotId: "b", qty: 4, totalCost: 24_000n },
    ]);
    expect(plan.totalCost).toBe(39_000n);
  });

  it("menandai shortage ketika stok tidak cukup", () => {
    const plan = planFifoConsumption([lot("a", 2, 5_000n, "2026-01-01T00:00:00Z")], 5);
    expect(plan.allocations[0]?.qty).toBe(2);
    expect(plan.shortage).toBe(3);
    expect(plan.totalCost).toBe(10_000n);
  });

  it("pemakaian nol menyebabkan rencana kosong", () => {
    const plan = planFifoConsumption([lot("a", 5, 5_000n, "2026-01-01T00:00:00Z")], 0);
    expect(plan.allocations).toHaveLength(0);
    expect(plan.totalCost).toBe(0n);
  });

  it("lot dengan sisa 0 dilewati", () => {
    const plan = planFifoConsumption([lot("empty", 0, 9_000n, "2026-01-01T00:00:00Z"), lot("a", 4, 5_000n, "2026-01-02T00:00:00Z")], 2);
    expect(plan.allocations[0]?.lotId).toBe("a");
  });

  it("fifoStockValue menjumlah sisa lot", () => {
    expect(fifoStockValue([lot("a", 2, 5_000n, "2026-01-01T00:00:00Z"), lot("b", 3, 6_000n, "2026-01-02T00:00:00Z")])).toBe(28_000n);
    expect(fifoStockValue([lot("zero", 0, 5_000n, "2026-01-01T00:00:00Z")])).toBe(0n);
  });
});
