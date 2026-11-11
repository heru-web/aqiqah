"use client";

import { useEffect, useRef, useState, useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlusIcon,
  CheckIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  addFollowupAction,
  cancelFollowupAction,
  markFollowupDoneAction,
  type LeadFormState,
} from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { leadDueState } from "@/lib/crm/pipeline";
import { toast } from "sonner";

export interface FollowupItem {
  id: string;
  method: string;
  summary: string | null;
  dueAt: string | null;
  status: string;
  completedAt: string | null;
  agentName: string | null;
  createdAt: string;
}

const METHOD_META: Record<string, { label: string; icon: React.ReactNode }> = {
  WA: { label: "WhatsApp", icon: <MessageCircleIcon className="h-3.5 w-3.5" /> },
  CALL: { label: "Telepon", icon: <PhoneIcon className="h-3.5 w-3.5" /> },
  MEETING: { label: "Meeting", icon: <UsersIcon className="h-3.5 w-3.5" /> },
  EMAIL: { label: "Email", icon: <MailIcon className="h-3.5 w-3.5" /> },
};

const STATUS_META: Record<string, { label: string; variant: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  PLANNED: { label: "Dijadwalkan", variant: "info" },
  DONE: { label: "Selesai", variant: "success" },
  MISSED: { label: "Terlewat", variant: "danger" },
  CANCELLED: { label: "Dibatalkan", variant: "neutral" },
};

function dueBadge(item: FollowupItem) {
  if (item.status !== "PLANNED" || !item.dueAt) return null;
  const state = leadDueState(item.dueAt);
  if (state === "OVERDUE") return <Badge variant="danger">Terlambat</Badge>;
  if (state === "TODAY") return <Badge variant="gold">Hari ini</Badge>;
  return <Badge variant="neutral">{formatDateTime(item.dueAt)}</Badge>;
}

export function LeadFollowupPanel({ leadId, followups }: { leadId: string; followups: FollowupItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startAction] = useTransition();
  const [state, action, pending] = useActionState<LeadFormState, FormData>(addFollowupAction, undefined);
  const planned = followups.filter((item) => item.status === "PLANNED");
  const history = followups.filter((item) => item.status !== "PLANNED");

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const run = (id: string, fn: (id: string) => Promise<{ error?: string }>, successMessage: string) => {
    setPendingId(id);
    startAction(async () => {
      const result = await fn(id);
      setPendingId(null);
      if (result.error) toast.error(result.error);
      else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="rounded-xl border border-line/10 bg-surface-dim/50 p-3">
        <input type="hidden" name="leadId" value={leadId} />
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <CalendarPlusIcon className="h-3.5 w-3.5" /> Jadwalkan follow-up
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="followup-method" className="text-[11px]">
              Metode
            </Label>
            <Select id="followup-method" name="method" defaultValue="WA" className="h-9 text-xs">
              <option value="WA">WhatsApp</option>
              <option value="CALL">Telepon</option>
              <option value="MEETING">Meeting</option>
              <option value="EMAIL">Email</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="followup-due" className="text-[11px]">
              Jadwal
            </Label>
            <Input id="followup-due" name="dueAt" type="datetime-local" className="h-9 text-xs" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <Label htmlFor="followup-summary" className="text-[11px]">
            Catatan / agenda
          </Label>
          <Textarea
            id="followup-summary"
            name="summary"
            rows={2}
            placeholder="Contoh: konfirmasi tanggal aqiqah dan jumlah porsi…"
            className="text-xs"
          />
        </div>
        {state?.error && (
          <p className="mt-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger-soft-foreground">
            {state.error}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Menyimpan…" : "Tambah Follow-up"}
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Rencana ({planned.length})
        </p>
        {planned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line/15 py-5 text-center text-xs text-muted-foreground">
            Belum ada follow-up terjadwal.
          </p>
        ) : (
          <div className="space-y-2">
            {planned.map((item) => {
              const meta = METHOD_META[item.method] ?? { label: item.method, icon: null };
              return (
                <div key={item.id} className="rounded-xl border border-line/10 bg-surface p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span className="text-primary">{meta.icon}</span>
                    {meta.label}
                    {dueBadge(item)}
                  </div>
                  {item.summary && <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {item.agentName ? `oleh ${item.agentName}` : "—"}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="success"
                        size="compact"
                        disabled={pendingId === item.id}
                        onClick={() => run(item.id, markFollowupDoneAction, "Follow-up selesai")}
                      >
                        <CheckIcon className="h-3 w-3" /> Selesai
                      </Button>
                      <Button
                        variant="ghost"
                        size="compact"
                        disabled={pendingId === item.id}
                        onClick={() => run(item.id, cancelFollowupAction, "Follow-up dibatalkan")}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <details className="rounded-xl border border-line/10 bg-surface/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Riwayat follow-up ({history.length})
          </summary>
          <div className="mt-2 space-y-2">
            {history.map((item) => {
              const meta = METHOD_META[item.method] ?? { label: item.method, icon: null };
              const status = STATUS_META[item.status] ?? { label: item.status, variant: "neutral" as const };
              return (
                <div key={item.id} className="rounded-lg bg-surface/70 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground">
                    <span className="text-muted-foreground">{meta.icon}</span>
                    {meta.label}
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatDateTime(item.completedAt ?? item.createdAt)}
                    </span>
                  </div>
                  {item.summary && <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
