"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, LockIcon, UserRoundIcon } from "lucide-react";
import { assignLeadAction, transitionLeadAction } from "@/server/actions/leads";
import {
  LEAD_STAGE_META,
  allowedLeadTransitions,
  isLeadClosed,
  nextLeadStage,
  type LeadStage,
} from "@/lib/crm/pipeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface OwnerOption {
  id: string;
  name: string;
}

export function LeadStatusActions({
  leadId,
  status,
  assignedTo,
  owners,
  closedReason,
}: {
  leadId: string;
  status: LeadStage;
  assignedTo: string | null;
  owners: OwnerOption[];
  closedReason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ownerPending, startOwner] = useTransition();
  const next = nextLeadStage(status);
  const targets = allowedLeadTransitions(status);
  const [target, setTarget] = useState<LeadStage | "">(next ?? targets[0] ?? "");
  const [closeOpen, setCloseOpen] = useState(false);
  const [reason, setReason] = useState(closedReason ?? "");

  const move = (to: LeadStage, closeReason?: string) => {
    startTransition(async () => {
      const result = await transitionLeadAction(leadId, to, closeReason);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Status → ${LEAD_STAGE_META[to].label}`);
        setCloseOpen(false);
        router.refresh();
      }
    });
  };

  const submitTarget = () => {
    if (!target) return;
    if (target === "CLOSED") {
      setCloseOpen(true);
      return;
    }
    move(target);
  };

  const changeOwner = (value: string) => {
    startOwner(async () => {
      const result = await assignLeadAction(leadId, value || null);
      if (result.error) toast.error(result.error);
      else {
        toast.success(value ? "Pemilik lead diperbarui" : "Lead dilepas dari pemilik");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lead-owner-select" className="flex items-center gap-1.5">
          <UserRoundIcon className="h-3.5 w-3.5" /> Penanggung jawab
        </Label>
        <Select
          id="lead-owner-select"
          value={assignedTo ?? ""}
          disabled={ownerPending}
          onChange={(event) => changeOwner(event.target.value)}
        >
          <option value="">Belum ditugaskan</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>
      </div>

      {isLeadClosed(status) ? (
        <div className="rounded-xl bg-primary/8 p-3 ring-1 ring-line/10">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <LockIcon className="h-3.5 w-3.5" /> Lead sudah selesai
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {closedReason ? `Alasan: ${closedReason}` : "Tidak ada alasan penutupan yang dicatat."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {next && (
            <Button
              className="w-full"
              onClick={() => {
                if (next === "CLOSED") setCloseOpen(true);
                else move(next);
              }}
              disabled={pending}
            >
              <ArrowRightIcon className="h-4 w-4" /> Majukan ke {LEAD_STAGE_META[next].label}
            </Button>
          )}
          <div className="flex gap-2">
            <Select
              value={target}
              onChange={(event) => setTarget(event.target.value as LeadStage)}
              disabled={pending || targets.length === 0}
              aria-label="Pilih tahap tujuan"
            >
              {targets.length === 0 && <option value="">Tidak ada transisi</option>}
              {targets.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_META[stage].label}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={submitTarget}
              disabled={pending || !target}
              title="Pindahkan ke tahap terpilih"
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Arahkan kartu di papan atau gunakan tombol di atas. Transisi mundur hanya untuk koreksi.
          </p>
        </div>
      )}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tutup lead</DialogTitle>
            <DialogDescription>
              Lead akan dipindahkan ke tahap Selesai. Catat alasan/hasil akhir agar riwayat tetap jelas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="close-reason">Alasan / hasil</Label>
            <Textarea
              id="close-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: akad selesai, memilih vendor lain, budget tidak cocok…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => move("CLOSED", reason)} disabled={pending}>
              {pending ? "Menyimpan…" : "Tutup Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
