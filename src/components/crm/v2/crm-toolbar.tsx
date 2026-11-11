"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Columns3Icon, SearchIcon, Table2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StageData, UserOption } from "./types";

export interface CrmToolbarValues {
  q: string;
  stage: string;
  owner: string;
  status: string;
  view: "board" | "table";
}

export function CrmToolbar({
  initial,
  stages,
  users,
}: {
  initial: CrmToolbarValues;
  stages: StageData[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q);

  function apply(patch: Partial<CrmToolbarValues>) {
    const next = { ...initial, q, ...patch };
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.stage) params.set("stage", next.stage);
    if (next.owner) params.set("owner", next.owner);
    if (next.status && next.status !== "ALL") params.set("status", next.status);
    if (next.view === "table") params.set("view", "table");
    const query = params.toString();
    startTransition(() => router.push(query ? `/crm?${query}` : "/crm"));
  }

  function setView(view: "board" | "table") {
    if (view === initial.view) return;
    const params = new URLSearchParams();
    if (initial.q) params.set("q", initial.q);
    if (initial.stage) params.set("stage", initial.stage);
    if (initial.owner) params.set("owner", initial.owner);
    if (initial.status && initial.status !== "ALL") params.set("status", initial.status);
    if (view === "table") params.set("view", "table");
    const query = params.toString();
    startTransition(() => router.push(query ? `/crm?${query}` : "/crm"));
  }

  const hasFilter = Boolean(initial.q || initial.stage || initial.owner || (initial.status && initial.status !== "ALL"));

  return (
    <div className={`mb-4 rounded-2xl border border-line/10 bg-surface/60 p-3 transition ${pending ? "opacity-70" : ""}`}>
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
            placeholder="Cari deal, kontak, telepon, atau perusahaan…"
            className="pl-9 pr-9"
            aria-label="Cari deal"
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
          <Select
            value={initial.status || "ALL"}
            onChange={(event) => apply({ status: event.target.value })}
            className="h-9 w-auto min-w-[122px] text-xs"
            aria-label="Filter status deal"
          >
            <option value="ALL">Semua status</option>
            <option value="OPEN">Berjalan</option>
            <option value="WON">Jadi pesanan</option>
            <option value="LOST">Batal</option>
          </Select>
          <Select
            value={initial.stage}
            onChange={(event) => apply({ stage: event.target.value })}
            className="h-9 w-auto min-w-[132px] text-xs"
            aria-label="Filter tahap"
          >
            <option value="">Semua tahap</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
          <Select
            value={initial.owner}
            onChange={(event) => apply({ owner: event.target.value })}
            className="h-9 w-auto min-w-[136px] text-xs"
            aria-label="Filter pemilik"
          >
            <option value="">Semua pemilik</option>
            <option value="UNASSIGNED">Belum ditugaskan</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>

          {hasFilter && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              className="h-9 text-xs"
              onClick={() => {
                setQ("");
                startTransition(() => router.push("/crm"));
              }}
            >
              Reset
            </Button>
          )}

          <div className="ml-auto inline-flex rounded-xl border border-line/10 bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                initial.view === "board" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={initial.view === "board"}
            >
              <Columns3Icon className="h-3.5 w-3.5" /> Papan
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                initial.view === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={initial.view === "table"}
            >
              <Table2Icon className="h-3.5 w-3.5" /> Tabel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
