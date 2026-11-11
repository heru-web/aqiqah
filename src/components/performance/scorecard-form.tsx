"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, MinusIcon, PlusIcon, SendIcon, ShieldCheckIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { saveDailyScorecardAction } from "@/server/actions/performance";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

export interface ScorecardLineProp {
  indicatorId: string;
  code: string;
  name: string;
  unit: string;
  direction: string;
  targetValue: number;
  actualValue: number | null;
  weight: number;
  source: string | null;
  formulaKey: string | null;
  notes: string | null;
}

interface Props {
  date: string;
  departmentId: string;
  cardId: string | null;
  status: string;
  notes: string;
  lines: ScorecardLineProp[];
}

const isNumericStep = (unit: string) => unit === "CURRENCY" || unit === "COUNT" || unit === "DURATION";

function formatValue(v: number, unit: string): string {
  if (unit === "CURRENCY") return v.toLocaleString("id-ID");
  return String(v);
}

export function ScorecardForm({ date, departmentId, cardId, status, notes: initialNotes, lines }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.indicatorId, l.actualValue !== null ? String(l.actualValue) : ""]))
  );
  const [notes, setNotes] = useState(initialNotes);
  const [askVerify, setAskVerify] = useState(false);

  const filled = useMemo(() => lines.filter((l) => values[l.indicatorId] !== "").length, [lines, values]);
  const locked = status === "VERIFIED";

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));
  const step = (id: string, delta: number, unit: string) => {
    const cur = Number(values[id] || 0);
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    setValue(id, unit === "CURRENCY" ? String(next) : String(next));
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = lines.map((l) => ({
      indicatorId: l.indicatorId,
      actualValue: values[l.indicatorId] || "0",
      targetValue: String(l.targetValue),
      weight: String(l.weight),
    }));
    const fd = new FormData();
    fd.set("date", date);
    fd.set("departmentId", departmentId);
    fd.set("notes", notes);
    fd.set("lines", JSON.stringify(payload));
    if (cardId) fd.set("id", cardId);
    start(async () => {
      const res = await saveDailyScorecardAction(undefined, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Scorecard tersimpan");
        router.refresh();
      }
    });
  }

  function runVerify() {
    if (!cardId) return;
    start(async () => {
      const res = await import("@/server/actions/performance").then((m) =>
        m.verifyDailyScorecardAction(cardId)
      );
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Scorecard terverifikasi");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={status === "VERIFIED" ? "success" : status === "SUBMITTED" ? "info" : "neutral"}>{status}</Badge>
          <span className="text-sm text-muted-foreground">
            {filled}/{lines.length} terisi
          </span>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${lines.length > 0 ? (filled / lines.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tidak ada indikator harian untuk departemen ini. Atur target harian di Pengaturan KPI.
          </p>
        )}
        {lines.map((l) => {
          const val = values[l.indicatorId] ?? "";
          return (
            <div key={l.indicatorId} className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.code} · target {formatValue(l.targetValue, l.unit)} {l.unit === "CURRENCY" ? "Rp" : ""}
                    {l.source ? ` · data ${l.source}` : ""}
                    {l.formulaKey ? " · otomatis" : ""}
                  </p>
                </div>
                <Badge variant="warning" className="capitalize">
                  {l.direction === "LOWER_BETTER" ? "makin kecil" : "makin besar"}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {isNumericStep(l.unit) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Kurangi"
                    disabled={locked}
                    onClick={() => step(l.indicatorId, l.unit === "CURRENCY" ? -100000 : -1, l.unit)}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </Button>
                )}
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={val}
                  disabled={locked}
                  onChange={(e) => setValue(l.indicatorId, e.target.value)}
                  placeholder="0"
                  className="h-11 w-full min-w-0 flex-1 rounded-2xl bg-background px-3.5 text-right font-display text-lg font-semibold text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60"
                />
                {isNumericStep(l.unit) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Tambah"
                    disabled={locked}
                    onClick={() => step(l.indicatorId, l.unit === "CURRENCY" ? 100000 : 1, l.unit)}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sc-notes" className="text-xs font-medium text-muted-foreground">
          Catatan
        </label>
        <Textarea
          id="sc-notes"
          value={notes}
          disabled={locked}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan opsional untuk supervisor…"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || locked} variant="default">
          <SaveIcon className="h-4 w-4" />
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        {cardId && status === "DRAFT" && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const fd = new FormData();
                const payload = lines.map((l) => ({
                  indicatorId: l.indicatorId,
                  actualValue: values[l.indicatorId] || "0",
                  targetValue: String(l.targetValue),
                  weight: String(l.weight),
                }));
                fd.set("date", date);
                fd.set("departmentId", departmentId);
                fd.set("notes", notes);
                fd.set("lines", JSON.stringify(payload));
                fd.set("id", cardId);
                const saved = await saveDailyScorecardAction(undefined, fd);
                if (saved?.error) {
                  toast.error(saved.error);
                  return;
                }
                const res = await import("@/server/actions/performance").then((m) =>
                  m.submitDailyScorecardAction(cardId)
                );
                if (res?.error) toast.error(res.error);
                else {
                  toast.success("Scorecard diajukan");
                  router.refresh();
                }
              });
            }}
          >
            <SendIcon className="h-4 w-4" />
            Ajukan
          </Button>
        )}
        {cardId && (status === "DRAFT" || status === "SUBMITTED") && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setAskVerify(true)}
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Verifikasi
          </Button>
        )}
        {locked && (
          <span className="flex items-center gap-1 self-center text-xs text-muted-foreground">
            <CheckIcon className="h-4 w-4" /> Terverifikasi — tidak bisa diedit
          </span>
        )}
      </div>

      <ConfirmDialog
        open={askVerify}
        onOpenChange={setAskVerify}
        title="Verifikasi scorecard ini?"
        description="Setelah terverifikasi, perubahan berikutnya harus melalui revisi supervisor."
        confirmLabel="Ya, verifikasi"
        tone="info"
        pending={pending}
        onConfirm={() => {
          setAskVerify(false);
          runVerify();
        }}
      />
    </form>
  );
}
