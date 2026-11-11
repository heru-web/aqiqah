"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveAttendanceAction } from "@/server/actions/hr";

interface Row {
  id: string;
  employeeNumber: string;
  name: string;
  positionName: string | null;
  departmentName: string | null;
  status: string | null;
  lateMinutes: number;
  notes: string | null;
}

interface Props {
  date: string;
  rows: Row[];
}

const STATUSES = [
  { value: "", label: "— belum diisi —" },
  { value: "HADIR", label: "Hadir" },
  { value: "TERLAMBAT", label: "Terlambat" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPA", label: "Alpa" },
];

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  HADIR: "success",
  TERLAMBAT: "warning",
  IZIN: "info",
  SAKIT: "info",
  ALPA: "danger",
};

export function AttendanceBoard({ date, rows }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Record<string, { status: string; lateMinutes: string; notes: string }>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        { status: r.status ?? "", lateMinutes: String(r.lateMinutes || ""), notes: r.notes ?? "" },
      ])
    )
  );

  const filled = useMemo(
    () => Object.values(state).filter((s) => s.status !== "").length,
    [state]
  );

  const patch = (id: string, key: "status" | "lateMinutes" | "notes", value: string) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  function save() {
    const entries = Object.entries(state)
      .filter(([, s]) => s.status !== "")
      .map(([employeeId, s]) => ({
        employeeId,
        status: s.status,
        lateMinutes: Number(s.lateMinutes || 0),
        notes: s.notes,
      }));
    const fd = new FormData();
    fd.set("date", date);
    fd.set("entries", JSON.stringify(entries));
    start(async () => {
      const res = await saveAttendanceAction(undefined, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Absensi tersimpan (${entries.length} karyawan)`);
        router.refresh();
      }
    });
  }

  function markAll(status: string) {
    setState((prev) =>
      Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, { ...s, status: s.status || status }]))
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filled}/{rows.length} terisi
          </span>
          <Button variant="ghost" size="sm" onClick={() => markAll("HADIR")} disabled={pending}>
            Tandai sisa Hadir
          </Button>
        </div>
        <Button variant="default" size="sm" disabled={pending} onClick={save}>
          <SaveIcon className="h-4 w-4" />
          {pending ? "Menyimpan…" : "Simpan Absensi"}
        </Button>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Tidak ada karyawan aktif untuk diisi.</p>
        )}
        {rows.map((r) => {
          const s = state[r.id];
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface/60 p-3 ring-1 ring-border"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {r.name}{" "}
                  {r.status && (
                    <Badge variant={statusVariant[r.status] ?? "neutral"} className="ml-1 align-middle">
                      {r.status}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.employeeNumber} · {r.positionName ?? "—"}
                  {r.departmentName ? ` · ${r.departmentName}` : ""}
                </p>
              </div>
              <select
                aria-label={`Status ${r.name}`}
                value={s.status}
                onChange={(e) => patch(r.id, "status", e.target.value)}
                className="h-10 rounded-2xl bg-surface px-3 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                aria-label={`Menit terlambat ${r.name}`}
                value={s.lateMinutes}
                disabled={s.status !== "TERLAMBAT"}
                onChange={(e) => patch(r.id, "lateMinutes", e.target.value)}
                placeholder="mnt"
                className="h-10 w-20 rounded-2xl bg-surface px-3 text-right text-sm tabular-nums text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-40"
              />
              <input
                aria-label={`Catatan ${r.name}`}
                value={s.notes}
                onChange={(e) => patch(r.id, "notes", e.target.value)}
                placeholder="Catatan…"
                className="h-10 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
