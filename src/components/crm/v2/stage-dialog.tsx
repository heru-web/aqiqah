"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CRM_STAGE_COLORS, STAGE_TYPE_LABELS, stageColorClasses } from "@/lib/crm/crm";
import { createStageAction, updateStageAction, type CrmFormState } from "@/server/actions/crm";
import type { StageData } from "./types";

export function StageDialog({
  pipelineId,
  stage,
  trigger,
}: {
  pipelineId: string;
  stage?: StageData;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = stage ? updateStageAction.bind(null, stage.id) : createStageAction;
  const [state, action, pending] = useActionState<CrmFormState, FormData>(
    async (previous, formData) => {
      const result = await bound(previous, formData);
      if (result?.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? "Ubah Tahap" : "Tahap Baru"}</DialogTitle>
          <DialogDescription>
            Tahap menentukan posisi potensi pesanan di papan dan apakah nilainya dihitung sebagai pesanan masuk atau batal.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="pipelineId" value={pipelineId} />

          <div className="space-y-1.5">
            <Label htmlFor="stage-name">Nama *</Label>
            <Input id="stage-name" name="name" required minLength={2} defaultValue={stage?.name ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stage-description">Deskripsi</Label>
            <Textarea
              id="stage-description"
              name="description"
              rows={2}
              defaultValue={stage?.description ?? ""}
              placeholder="Kapan deal masuk tahap ini?"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="stage-color">Warna</Label>
              <Select id="stage-color" name="color" defaultValue={stage?.color ?? "slate"}>
                {CRM_STAGE_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-type">Jenis</Label>
              <Select id="stage-type" name="type" defaultValue={stage?.type ?? "OPEN"}>
                {Object.entries(STAGE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-line/10 bg-subtle px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pratinjau</p>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                stageColorClasses(stage?.color ?? "slate").soft
              } ${stageColorClasses(stage?.color ?? "slate").text}`}
            >
              <span className={`size-1.5 rounded-full ${stageColorClasses(stage?.color ?? "slate").dot}`} />
              {stage?.name || "Nama tahap"}
            </span>
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <PlusIcon className="h-4 w-4" /> {pending ? "Menyimpan…" : stage ? "Simpan Perubahan" : "Simpan Tahap"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
