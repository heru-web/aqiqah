"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSopChecksAction } from "@/server/actions/hr";
import type { MasterFormState } from "@/components/performance/master-crud-dialog";

interface Props {
  sops: Array<{ id: string; code: string; title: string }>;
  employees: Array<{ id: string; name: string }>;
  periodStart: string;
  periodEnd: string;
}

export function SopCheckDialog({ sops, employees, periodStart, periodEnd }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<MasterFormState, FormData>(
    async (prev, fd) => {
      const res = await saveSopChecksAction(prev, fd);
      if (res?.success) {
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    undefined
  );
  const entriesRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const entries = [
      {
        sopId: String(fd.get("sopId") ?? ""),
        employeeId: String(fd.get("employeeId") ?? ""),
        score: String(fd.get("score") ?? "0"),
        notes: String(fd.get("notes") ?? ""),
      },
    ];
    if (entriesRef.current) entriesRef.current.value = JSON.stringify(entries);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <ClipboardCheckIcon className="h-4 w-4" />
          Catat Pengecekan SOP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pengecekan SOP</DialogTitle>
          <DialogDescription>
            Satu pengecekan (SOP × karyawan) per simpan; skor 0–100 untuk periode {periodStart} – {periodEnd}.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="periodStart" value={periodStart} />
          <input type="hidden" name="periodEnd" value={periodEnd} />
          <input type="hidden" name="entries" ref={entriesRef} defaultValue="[]" />
          <div className="space-y-1.5">
            <Label htmlFor="sop-id">
              SOP <span className="text-danger">*</span>
            </Label>
            <Select id="sop-id" name="sopId" required>
              <option value="">— pilih —</option>
              {sops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sop-emp">
              Karyawan <span className="text-danger">*</span>
            </Label>
            <Select id="sop-emp" name="employeeId" required>
              <option value="">— pilih —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sop-score">
              Skor (0–100) <span className="text-danger">*</span>
            </Label>
            <Input id="sop-score" name="score" type="number" min={0} max={100} step="any" defaultValue="100" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sop-notes">Catatan</Label>
            <Textarea id="sop-notes" name="notes" rows={3} placeholder="Temuan pengecekan…" />
          </div>
          {state?.error && (
            <p className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger-soft-foreground ring-1 ring-danger/25">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Menyimpan…" : "Simpan Pengecekan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
