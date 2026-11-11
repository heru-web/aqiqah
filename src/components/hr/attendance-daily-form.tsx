"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SaveIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveAttendanceAction } from "@/server/actions/hr";

type FormState = { error?: string; success?: boolean } | undefined;

export interface AttendanceRow {
  id: string;
  employeeNumber: string;
  name: string;
  positionName: string | null;
  departmentName: string | null;
  status: string | null;
  lateMinutes: number;
  notes: string | null;
}

interface Draft {
  status: string;
  lateMinutes: number;
  notes: string;
}

const STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "TERLAMBAT", label: "Terlambat" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPA", label: "Alpa" },
] as const;

export function AttendanceDailyForm({ date, rows }: { date: string; rows: AttendanceRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          status: r.status ?? "HADIR",
          lateMinutes: r.lateMinutes ?? 0,
          notes: r.notes ?? "",
        },
      ])
    )
  );
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, fd) => {
      const res = await saveAttendanceAction(prev, fd);
      if (res?.success) {
        toast.success("Absensi tersimpan.");
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    undefined
  );

  const entries = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          employeeId: r.id,
          status: draft[r.id]?.status ?? "HADIR",
          lateMinutes: draft[r.id]?.lateMinutes ?? 0,
          notes: draft[r.id]?.notes || undefined,
        }))
      ),
    [rows, draft]
  );

  function update(id: string, patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function markAllPresent() {
    setDraft((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, d]) => [id, { ...d, status: "HADIR", lateMinutes: 0 }])
      )
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="entries" value={entries} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <label htmlFor="attendance-date" className="text-xs font-medium text-muted-foreground">
            Tanggal absensi
          </label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                router.push(`/attendance?tanggal=${v}&bulan=${v.slice(0, 7)}`);
              }
            }}
            className="w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={markAllPresent}>
            <SparklesIcon className="h-4 w-4" />
            Tandai semua hadir
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            <SaveIcon className="h-4 w-4" />
            {pending ? "Menyimpan…" : "Simpan absensi"}
          </Button>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <div className="overflow-x-auto rounded-2xl ring-1 ring-line/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Karyawan</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-28">Terlambat (mnt)</TableHead>
              <TableHead className="w-64">Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada karyawan aktif. Tambahkan karyawan terlebih dahulu.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const d = draft[r.id] ?? { status: "HADIR", lateMinutes: 0, notes: "" };
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeNumber}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.positionName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        aria-label={`Status ${r.name}`}
                        value={d.status}
                        onChange={(e) => update(r.id, { status: e.target.value })}
                        className="h-9"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Menit terlambat ${r.name}`}
                        type="number"
                        min={0}
                        max={600}
                        value={d.lateMinutes}
                        disabled={d.status !== "TERLAMBAT"}
                        onChange={(e) =>
                          update(r.id, { lateMinutes: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Catatan ${r.name}`}
                        value={d.notes}
                        onChange={(e) => update(r.id, { notes: e.target.value })}
                        placeholder="Opsional"
                        className="h-9"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Status default Hadir. Perubahan disimpan untuk tanggal {date} dan otomatis muncul di Review
        Bulanan KPI.
      </p>
    </form>
  );
}
