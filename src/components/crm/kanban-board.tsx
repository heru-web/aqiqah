"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  MessageCircleIcon,
  MoreVerticalIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react";
import { transitionLeadAction } from "@/server/actions/leads";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import {
  LEAD_DUE_STATE_LABELS,
  LEAD_STAGE_META,
  LEAD_STAGES,
  allowedLeadTransitions,
  canTransitionLead,
  leadDueState,
  nextLeadStage,
  type LeadStage,
} from "@/lib/crm/pipeline";
import { formatDate, formatIDRShort, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export interface LeadCardData {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  source: string;
  status: LeadStage;
  productInterest: string | null;
  budget: string | null;
  ownerName: string | null;
  assignedTo: string | null;
  due: string | null;
  openFollowups: number;
}

const DUE_CLASS: Record<string, string> = {
  OVERDUE: "bg-danger-soft text-danger-soft-foreground ring-danger/15",
  TODAY: "bg-gold-soft text-gold-soft-foreground ring-gold/20",
  SOON: "bg-warning-soft text-warning-soft-foreground ring-warning/15",
  LATER: "bg-muted text-muted-foreground ring-line/10",
  NONE: "bg-muted/60 text-muted-foreground ring-line/10",
};

function dueLabel(due: string | null): string {
  const state = leadDueState(due);
  if (state === "NONE") return LEAD_DUE_STATE_LABELS.NONE;
  if (state === "OVERDUE") return "Terlambat";
  if (state === "TODAY") return "Hari ini";
  return formatDate(due);
}

function LeadCard({
  lead,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadCardData;
  onMove: (lead: LeadCardData, to: LeadStage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const next = nextLeadStage(lead.status);
  const due = leadDueState(lead.due);
  const targets = allowedLeadTransitions(lead.status);

  const goDetail = () => router.push(`/crm/${lead.id}`);

  return (
    <article
      role="link"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", lead.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={goDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goDetail();
        }
      }}
      className="group cursor-pointer rounded-xl border border-line/10 bg-surface p-3 shadow-card outline-none transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        <GripVerticalIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-headline-sm text-[14px] text-foreground">{lead.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {[lead.company, lead.city].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        {next && (
          <Button
            variant="ghost"
            size="compact"
            className="h-7 w-7 shrink-0 p-0"
            title={`Majukan → ${LEAD_STAGE_META[next].label}`}
            onClick={(event) => {
              event.stopPropagation();
              onMove(lead, next);
            }}
          >
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="gold">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</Badge>
        {lead.productInterest && <Badge variant="neutral">{lead.productInterest}</Badge>}
        {lead.budget && <Badge variant="success">{formatIDRShort(lead.budget)}</Badge>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${DUE_CLASS[due]}`}
        >
          <CalendarClockIcon className="h-3 w-3" />
          {dueLabel(lead.due)}
        </span>
        {lead.openFollowups > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {lead.openFollowups} follow-up
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-line/10 pt-2.5">
        {lead.assignedTo ? (
          <span
            className="grid size-6 place-items-center rounded-full bg-primary/15 text-[9px] font-bold uppercase text-primary ring-1 ring-line/10"
            title={lead.ownerName ?? "Pemilik"}
          >
            {initials(lead.ownerName)}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Belum ada pemilik
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {lead.phone && (
            <>
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chat WhatsApp"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-success-soft-foreground hover:bg-success-soft"
              >
                <MessageCircleIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href={`tel:${lead.phone}`}
                title="Telepon"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
              </a>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Pindahkan / buka"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVerticalIcon className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuLabel>Pindahkan ke</DropdownMenuLabel>
              {targets.length === 0 && (
                <DropdownMenuItem disabled>Lead sudah selesai</DropdownMenuItem>
              )}
              {targets.map((target) => (
                <DropdownMenuItem key={target} onSelect={() => onMove(lead, target)}>
                  <span className={`size-2 rounded-full ${LEAD_STAGE_META[target].dotClass}`} />
                  {LEAD_STAGE_META[target].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={goDetail}>
                <PencilIcon /> Buka detail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
      </div>
    </article>
  );
}

export function KanbanBoard({ leads }: { leads: LeadCardData[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragged, setDragged] = useState<LeadCardData | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const grouped = useMemo(
    () =>
      LEAD_STAGES.map((stage) => {
        const items = leads.filter((lead) => lead.status === stage);
        const value = items.reduce((sum, lead) => sum + Number(lead.budget ?? 0), 0);
        return { stage, items, value };
      }),
    [leads]
  );

  const move = (lead: LeadCardData, to: LeadStage) => {
    if (!canTransitionLead(lead.status, to)) {
      toast.error(
        `Tidak bisa memindahkan dari ${LEAD_STAGE_META[lead.status].label} ke ${LEAD_STAGE_META[to].label}.`
      );
      return;
    }
    startTransition(async () => {
      const result = await transitionLeadAction(lead.id, to);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${lead.name} → ${LEAD_STAGE_META[to].label}`);
        router.refresh();
      }
    });
  };

  return (
    <div className={`flex gap-3 overflow-x-auto pb-3 ${pending ? "opacity-70" : ""}`}>
      {grouped.map((column) => {
        const meta = LEAD_STAGE_META[column.stage];
        const canDrop = dragged ? canTransitionLead(dragged.status, column.stage) : false;
        return (
          <section
            key={column.stage}
            onDragOver={(event) => {
              if (!canDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverStage(column.stage);
            }}
            onDragLeave={() => setOverStage((current) => (current === column.stage ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const leadId = event.dataTransfer.getData("text/plain");
              const lead = leads.find((item) => item.id === leadId) ?? dragged;
              setOverStage(null);
              setDragged(null);
              if (lead && canTransitionLead(lead.status, column.stage)) move(lead, column.stage);
            }}
            className={`w-[286px] shrink-0 rounded-2xl border border-line/10 p-2.5 transition ${
              meta.columnClass
            } ${overStage === column.stage && canDrop ? "ring-2 ring-primary/35" : ""}`}
          >
            <header className="mb-2 flex items-center justify-between gap-2 px-1 pt-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={`size-2 shrink-0 rounded-full ${meta.dotClass}`} />
                <h2 className="truncate text-xs font-bold uppercase tracking-[0.05em] text-foreground">
                  {meta.label}
                </h2>
                <span className="rounded-full bg-surface/80 px-1.5 py-0.5 font-data text-[10px] font-semibold text-muted-foreground">
                  {column.items.length}
                </span>
              </div>
              {column.value > 0 && (
                <span className="shrink-0 font-data text-[10px] text-muted-foreground">
                  {formatIDRShort(column.value)}
                </span>
              )}
            </header>

            <div className="space-y-2">
              {column.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/15 py-8 text-center text-[11px] text-muted-foreground">
                  {canDrop ? "Lepaskan di sini" : "Kosong"}
                </p>
              ) : (
                column.items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onMove={move}
                    onDragStart={() => setDragged(lead)}
                    onDragEnd={() => {
                      setDragged(null);
                      setOverStage(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
