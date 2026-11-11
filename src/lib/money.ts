/**
 * Uang selalu BIGINT (integer rupiah penuh) di seluruh sistem — TIDAK PERNAH
 * float. Konversi string input → bigint dilakukan dengan parsing ketat.
 */

import { ValidationError } from "@/lib/errors";

/** Bulatkan ke rupiah penuh dari nilai string/desimal. */
export function parseIDR(input: string | number | null | undefined): bigint {
  if (input === null || input === undefined || input === "") return 0n;
  const s = typeof input === "number" ? String(input) : input.trim();
  const cleaned = s.replace(/[Rp\s.,]/g, "").replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(cleaned)) {
    throw new ValidationError("Nilai rupiah tidak valid.", { input });
  }
  return BigInt(cleaned);
}

/** bias: 2 — persen sebagai basis 10000 (BPS). nilai = rawBPS/100 pada penjumlahan. */
export function parseBPS(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(String(input).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new ValidationError("Persentase harus antara 0 dan 100.", { input });
  }
  return Math.round(n * 100); // BPS (1% = 100 BPS)
}

export function bpsOf(value: number): number {
  return value / 100;
}

export function formatRupiahFull(value: bigint | number): string {
  const n = typeof value === "bigint" ? value : BigInt(Math.round(value));
  const str = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${str}`;
}

export function formatRupiahShort(value: bigint): string {
  const abs = value < 0n ? -value : value;
  if (abs >= 1_000_000_000n)
    return `${(Number(value) / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000n)
    return `${(Number(value) / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000n)
    return `${(Number(value) / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return value.toString();
}

/** BPS (basis point, 100 = 1%) dikalikan nilai → lalu bulatkan ke rupiah penuh. */
export function percentOfBPS(value: bigint, bps: number): bigint {
  if (bps === 0) return 0n;
  return (value * BigInt(Math.trunc(bps))) / 10000n;
}

export const ZERO = 0n;