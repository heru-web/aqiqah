"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, SaveIcon, Trash2Icon, CheckCircle2Icon, FlagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/performance/action-button";
import { saveWeeklyReviewAction, finalizeWeeklyReviewAction } from "@/server/actions/performance";

export interface DecisionItem {
  text: string;
  owner: string;
  dueDate: string;
  done: boolean;
}

interface Props {
  weekStart: string;
  reviewId: string | null;
  reviewStatus: string | null;
  decisions: DecisionItem[];
}

const emptyItem = (): DecisionItem => ({ text: "", owner: "", dueDate: "", done: false });

export function WeeklyEditor({ weekStart, reviewId, reviewStatus, decisions }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<DecisionItem[]>(decisions.length > 0 ? decisions : [emptyItem()]);

  const update = (i: number, patch: Partial<DecisionItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  function save() {
    const cleaned = items.filter((it) => it.text.trim() !== "");
    const fd = new FormData();
    fd.set("weekStart", weekStart);
    fd.set("decisions", JSON.stringify(cleaned));
    start(async () => {
      const res = await saveWeeklyReviewAction(undefined, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Review mingguan tersimpan");
        router.refresh();
      }
    });
  }

  const finalized = reviewStatus === "FINAL";
  const open = items.filter((it) => it.text.trim() !== "" && !it.done).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={finalized ? "success" : reviewStatus ? "info" : "neutral"}>
            {reviewStatus ?? "BELUM DISIMPAN"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {open} action item terbuka
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" disabled={pending} onClick={save}>
            <SaveIcon className="h-4 w-4" />
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          {reviewId && !finalized && (
            <ActionButton
              action={finalizeWeeklyReviewAction}
              params={[reviewId]}
              label="Finalisasi"
              icon={<FlagIcon className="h-4 w-4" />}
              variant="secondary"
              confirmMessage="Finalisasi review mingguan minggu ini? Data metrik dikunci."
              successMessage="Review mingguan terfinalisasi"
              disabled={pending}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Isi action item hasil review (keputusan, pemilik, tenggat), lalu Simpan → Finalisasi. Metrik 9 indikator
        dihitung otomatis dari data ERP.
      </p>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface/60 p-3 ring-1 ring-border"
          >
            <Input
              value={it.text}
              disabled={finalized}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Action item…"
              className="min-w-0 flex-1"
            />
            <Input
              value={it.owner}
              disabled={finalized}
              onChange={(e) => update(i, { owner: e.target.value })}
              placeholder="Pemilik"
              className="w-36"
            />
            <Input
              type="date"
              value={it.dueDate}
              disabled={finalized}
              onChange={(e) => update(i, { dueDate: e.target.value })}
              className="w-40"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={it.done}
                disabled={finalized}
                onChange={(e) => update(i, { done: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Selesai
            </label>
            {!finalized && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Hapus action item"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2Icon className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!finalized && (
        <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
          <PlusIcon className="h-4 w-4" />
          Tambah action item
        </Button>
      )}
      {finalized && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2Icon className="h-4 w-4 text-success" /> Review terfinalisasi — tidak bisa diedit.
        </p>
      )}
    </div>
  );
}
