"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { LEAD_DUE_FILTER_LABELS, type LeadDueFilter } from "@/lib/crm/pipeline";

export interface CrmFilterValues {
  q: string;
  source: string;
  owner: string;
  due: string;
}

interface OwnerOption {
  id: string;
  name: string;
}

export function CrmFilters({
  initial,
  owners,
}: {
  initial: CrmFilterValues;
  owners: OwnerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q);

  const apply = (patch: Partial<CrmFilterValues>) => {
    const next = { ...initial, q, ...patch };
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.source && next.source !== "ALL") params.set("source", next.source);
    if (next.owner) params.set("owner", next.owner);
    if (next.due && next.due !== "ALL") params.set("due", next.due);
    const query = params.toString();
    startTransition(() => router.push(query ? `/crm?${query}` : "/crm"));
  };

  const reset = () => {
    setQ("");
    startTransition(() => router.push("/crm"));
  };

  const hasFilter =
    Boolean(initial.q) ||
    (initial.source && initial.source !== "ALL") ||
    Boolean(initial.owner) ||
    (initial.due && initial.due !== "ALL");

  return (
    <div className="rounded-2xl border border-line/10 bg-surface/60 p-3 backdrop-blur-xl">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({});
          }}
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cari nama, telepon, email, atau perusahaan…"
            className="pl-9 pr-9"
            aria-label="Cari lead"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                apply({ q: "" });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
            <SlidersHorizontalIcon className="h-3.5 w-3.5" /> Filter
          </div>
          <Select
            value={initial.source || "ALL"}
            onChange={(event) => apply({ source: event.target.value })}
            className="h-9 w-auto min-w-[132px] text-xs"
            aria-label="Filter sumber lead"
          >
            <option value="ALL">Semua sumber</option>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={initial.owner}
            onChange={(event) => apply({ owner: event.target.value })}
            className="h-9 w-auto min-w-[140px] text-xs"
            aria-label="Filter penanggung jawab"
          >
            <option value="">Semua pemilik</option>
            <option value="me">Punya saya</option>
            <option value="unassigned">Belum ditugaskan</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
          <Select
            value={initial.due || "ALL"}
            onChange={(event) => apply({ due: event.target.value as LeadDueFilter })}
            className="h-9 w-auto min-w-[132px] text-xs"
            aria-label="Filter jadwal follow-up"
          >
            {(Object.keys(LEAD_DUE_FILTER_LABELS) as LeadDueFilter[]).map((value) => (
              <option key={value} value={value}>
                {LEAD_DUE_FILTER_LABELS[value]}
              </option>
            ))}
          </Select>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
              <XIcon className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>
      {pending && <p className="mt-2 text-[11px] text-muted-foreground">Memuat…</p>}
    </div>
  );
}
