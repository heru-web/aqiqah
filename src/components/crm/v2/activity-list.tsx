"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { completeActivityAction, deleteActivityAction } from "@/server/actions/crm";
import { formatDateTime } from "@/lib/utils";
import { ACTIVITY_TYPE_LABELS, CRM_DUE_LABELS, crmDueState } from "@/lib/crm/crm";

export interface ActivityItem {
  id: string;
  type: keyof typeof ACTIVITY_TYPE_LABELS;
  title: string;
  notes: string | null;
  dueAt: string | null;
  completedAt: string | null;
  ownerName: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  personName?: string | null;
}

export function ActivityList({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  const router = useRouter();

  async function toggle(id: string, done: boolean) {
    const result = await completeActivityAction(id);
    if (result.error) return result.error;
    toast.success(done ? "Aktivitas dibuka kembali." : "Aktivitas ditandai selesai.");
    router.refresh();
    return undefined;
  }

  async function remove(id: string) {
    const result = await deleteActivityAction(id);
    if (result.error) return result.error;
    toast.success("Aktivitas dihapus.");
    router.refresh();
    return undefined;
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line/20 px-3 py-6 text-center text-xs text-muted-foreground">
        Belum ada aktivitas.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const due = crmDueState(item.dueAt, item.completedAt);
        const done = Boolean(item.completedAt);
        return (
          <li
            key={item.id}
            className={`flex items-start gap-2 rounded-xl border border-line/10 bg-surface px-3 py-2.5 ${
              done ? "opacity-70" : ""
            }`}
          >
            <ConfirmButton
              tone="info"
              title={done ? "Buka kembali aktivitas ini?" : "Tandai aktivitas selesai?"}
              description={
                done
                  ? "Aktivitas akan kembali terbuka dan muncul lagi di daftar tugas."
                  : "Status selesai dicatat bersama waktu saat ini."
              }
              confirmLabel={done ? "Ya, buka kembali" : "Ya, tandai selesai"}
              onConfirm={() => toggle(item.id, done)}
              trigger={
                <button
                  type="button"
                  title={done ? "Tandai belum selesai" : "Tandai selesai"}
                  aria-label={done ? "Tandai belum selesai" : "Tandai selesai"}
                  className="mt-0.5 cursor-pointer text-muted-foreground transition hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {done ? <CheckCircle2Icon className="h-4 w-4 text-success" /> : <CircleIcon className="h-4 w-4" />}
                </button>
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className={`text-[13px] font-semibold ${done ? "line-through" : ""}`}>{item.title}</p>
                <Badge variant="neutral">{ACTIVITY_TYPE_LABELS[item.type] ?? item.type}</Badge>
                {!done && due !== "NONE" && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {CRM_DUE_LABELS[due]}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {item.dueAt ? formatDateTime(item.dueAt) : "Tanpa jadwal"}
                {item.ownerName ? ` · ${item.ownerName}` : ""}
              </p>
              {item.dealId && item.dealTitle && (
                <Link
                  href={`/crm/deals/${item.dealId}`}
                  className="mt-0.5 inline-block text-[11px] font-semibold text-primary hover:underline"
                >
                  {item.dealTitle}
                </Link>
              )}
              {!compact && item.notes && (
                <p className="mt-1 whitespace-pre-line text-[12px] text-foreground/80">{item.notes}</p>
              )}
            </div>
            <ConfirmButton
              tone="danger"
              title="Hapus aktivitas ini?"
              description="Aktivitas akan diarsipkan dari daftar dan tidak muncul lagi pada jadwal."
              confirmLabel="Ya, hapus aktivitas"
              onConfirm={() => remove(item.id)}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                  title="Hapus aktivitas"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
