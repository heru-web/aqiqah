"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Window halaman: 1 … x-1 x x+1 … total (meniru Jurnal Guru). */
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  const set = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (set.has(i)) pages.push(i);
  }
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

interface Props {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** Label data, mis. "karyawan". */
  unit?: string;
}

export function TablePagination({ current, total, pageSize, onChange, unit = "data" }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const pages = pageWindow(current, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} {unit} · Halaman {current}/{totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          aria-label="Halaman sebelumnya"
          className="grid size-11 place-items-center rounded-lg ring-1 ring-line/15 text-foreground/70 transition-colors hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground/70">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-label={`Halaman ${p}`}
              aria-current={p === current ? "page" : undefined}
              className={cn(
                "h-11 min-w-11 rounded-lg px-2 text-xs font-semibold transition-colors",
                p === current
                  ? "bg-primary text-primary-foreground"
                  : "ring-1 ring-line/15 text-foreground/70 hover:bg-primary/5 hover:text-primary"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(current + 1)}
          disabled={current >= totalPages}
          aria-label="Halaman berikutnya"
          className="grid size-11 place-items-center rounded-lg ring-1 ring-line/15 text-foreground/70 transition-colors hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
