"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, ChevronLeftIcon, ChevronRightIcon, GripVerticalIcon } from "lucide-react";
import { toast } from "sonner";
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
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { moveDealAction } from "@/server/actions/crm";
import { crmDueState, stageColorClasses, STAGE_TYPE_LABELS } from "@/lib/crm/crm";
import { formatDate, formatIDRShort, initials } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import type { DealCardData, StageData, PersonOption, OrganizationOption, UserOption } from "@/components/crm/v2/types";

interface CrmBoardClientProps {
  stages: StageData[];
  deals: DealCardData[];
  people: PersonOption[];
  organizations: OrganizationOption[];
  users: UserOption[];
}

interface MoveTarget {
  dealId: string;
  dealTitle: string;
  stageId: string;
  stageName: string;
  stageType: "WON" | "LOST";
}

export function CrmBoardClient({ stages, deals, people, organizations, users }: CrmBoardClientProps) {
  void people;
  void organizations;
  void users;

  const router = useRouter();
  /** Optimistik: tahap baru per deal; otomatis tak berlaku jika prop `deals` sudah cocok. */
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moving, setMoving] = useState(false);

  const board = useMemo(
    () =>
      deals.map((deal) => {
        const override = overrides.get(deal.id);
        if (override && override !== deal.stageId) return { ...deal, stageId: override };
        return deal;
      }),
    [deals, overrides],
  );

  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [scrollState, setScrollState] = useState({ left: false, right: false, scrollable: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stageLefts = () => Array.from(el.children).map((c) => (c as HTMLElement).offsetLeft - el.offsetLeft);
    const update = () => {
      const ls = stageLefts();
      let nearest = 0;
      for (let i = 1; i < ls.length; i++) {
        if (Math.abs(el.scrollLeft - ls[i]) < Math.abs(el.scrollLeft - ls[nearest])) nearest = i;
      }
      setActiveStageIndex(nearest);
      const max = el.scrollWidth - el.clientWidth;
      setScrollState({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4, scrollable: max > 8 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [stages.length]);

  const scrollToStage = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const left = (el.children[index] as HTMLElement | undefined)?.offsetLeft;
    if (left != null) el.scrollTo({ left, behavior: "smooth" });
  };

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(260, Math.round(el.clientWidth * 0.8)), behavior: "smooth" });
  };

  async function applyMove(dealId: string, stageId: string): Promise<string | undefined> {
    const previous = overrides;
    setOverrides((current) => new Map(current).set(dealId, stageId));
    const result = await moveDealAction(dealId, stageId);
    if (result.error) {
      setOverrides((current) => {
        const next = new Map(current);
        if (previous.has(dealId)) next.set(dealId, previous.get(dealId)!);
        else next.delete(dealId);
        return next;
      });
      return result.error;
    }
    toast.success("Tahap deal diperbarui.");
    router.refresh();
    return undefined;
  }

  function requestMove(dealId: string, stageId: string) {
    const stage = stages.find((item) => item.id === stageId);
    const deal = deals.find((item) => item.id === dealId);
    if (!stage || !deal) return;
    if (stage.type === "OPEN") {
      void applyMove(dealId, stageId);
      return;
    }
    setMoveTarget({ dealId, dealTitle: deal.title, stageId, stageName: stage.name, stageType: stage.type });
  }

  async function confirmMove(): Promise<string | undefined> {
    if (!moveTarget) return undefined;
    setMoving(true);
    try {
      const error = await applyMove(moveTarget.dealId, moveTarget.stageId);
      if (error) return error;
      setMoveTarget(null);
      return undefined;
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="crm-board-wrapper">
      <div
        ref={scrollRef}
        className="scroll-x-auto flex snap-x snap-proximity gap-3 overflow-x-auto pb-3"
        tabIndex={0}
        role="region"
        aria-label="Papan pipeline CRM"
      >
        {stages.map((stage) => {
          const colors = stageColorClasses(stage.color);
          const stageDeals = board.filter((deal) => deal.stageId === stage.id);
          const total = stageDeals.reduce((sum, deal) => sum + BigInt(deal.value || "0"), 0n);
          const isOver = overStage === stage.id;
          return (
            <section
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || draggingId;
                setOverStage(null);
                setDraggingId(null);
                if (id) requestMove(id, stage.id);
              }}
              className={`flex min-w-[212px] max-w-[272px] max-[420px]:min-w-[236px] flex-1 snap-start flex-col rounded-2xl border bg-surface/55 transition ${
                isOver ? "border-primary/40 bg-primary/5" : colors.border
              }`}
            >
              <header className="flex items-center gap-2 border-b border-line/10 px-3 py-2.5">
                <span className={`size-2 rounded-full ${colors.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-headline-sm text-[13px] text-foreground">{stage.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stageDeals.length} deal · {formatIDRShort(total)}
                  </p>
                </div>
              </header>

              <div className="flex min-h-[180px] flex-1 flex-col gap-2 p-2">
                {stageDeals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line/20 px-3 py-6 text-center text-[11px] text-muted-foreground">
                    Tarik deal ke sini
                  </p>
                ) : (
                  stageDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      stages={stages}
                      dragging={draggingId === deal.id}
                      onDragStart={() => setDraggingId(deal.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onMove={requestMove}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {scrollState.scrollable && (
        <div className="flex items-center justify-center gap-3" role="group" aria-label="Navigasi tahap pipeline">
          <button
            type="button"
            aria-label="Geser ke kiri"
            onClick={() => scrollByPage(-1)}
            disabled={!scrollState.left}
            className="hidden size-7 place-items-center rounded-full border border-line/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-30 sm:grid"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <div className="scroll-dots" role="tablist" aria-label="Tahap pipeline">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={index === activeStageIndex}
                aria-label={stage.name}
                onClick={() => scrollToStage(index)}
                className={"dot " + (index === activeStageIndex ? "active" : "")}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Geser ke kanan"
            onClick={() => scrollByPage(1)}
            disabled={!scrollState.right}
            className="hidden size-7 place-items-center rounded-full border border-line/30 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-30 sm:grid"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={moveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setMoveTarget(null);
        }}
        pending={moving}
        tone={moveTarget?.stageType === "LOST" ? "danger" : "info"}
        title={
          moveTarget
            ? `Tandai deal "${moveTarget.dealTitle}" sebagai ${STAGE_TYPE_LABELS[moveTarget.stageType]}?`
            : ""
        }
        description={
          moveTarget
            ? moveTarget.stageType === "WON"
              ? `Pesanan akan masuk tahap "${moveTarget.stageName}", tanggal selesai diisi otomatis, dan nilainya masuk rekap pesanan masuk.`
              : `Potensi pesanan akan masuk tahap "${moveTarget.stageName}" dan tanggal selesai diisi otomatis. Nilainya tidak lagi dihitung dalam pipeline.`
            : ""
        }
        confirmLabel={moveTarget?.stageType === "WON" ? "Ya, jadi pesanan" : "Ya, tandai batal"}
        onConfirm={() => confirmMove()}
      />
    </div>
  );
}

function DealCard({
  deal,
  stages,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  deal: DealCardData;
  stages: StageData[];
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (dealId: string, stageId: string) => void;
}) {
  const router = useRouter();
  const otherStages = stages.filter((item) => item.id !== deal.stageId);
  const stage = stages.find((item) => item.id === deal.stageId);
  const colors = stageColorClasses(stage?.color);
  const due = crmDueState(deal.expectedCloseDate);
  const dueClass =
    due === "OVERDUE"
      ? "text-danger-soft-foreground"
      : due === "TODAY"
        ? "text-warning-soft-foreground"
        : "text-muted-foreground";

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", deal.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (!dragging) router.push(`/crm/deals/${deal.id}`);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/crm/deals/${deal.id}`);
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Buka deal ${deal.title}`}
      className={`group cursor-pointer rounded-xl border bg-surface p-3 shadow-card outline-none transition hover:-translate-y-0.5 hover:border-primary/25 focus-visible:ring-2 focus-visible:ring-ring ${
        dragging ? "opacity-50" : ""
      } ${colors.border}`}
    >
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden="true"
          className="mt-0.5 hidden cursor-grab text-muted-foreground/35 transition group-hover:block"
        >
          <GripVerticalIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[13px]">{deal.title}</p>
          <p className="mt-1 font-data text-[12px] font-semibold text-primary">{formatIDRShort(deal.value)}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {[deal.personName, deal.organizationName].filter(Boolean).join(" · ") || "Tanpa kontak"}
          </p>
          {deal.expectedCloseDate && (
            <p className={"mt-1 flex items-center gap-1 text-[11px] " + dueClass}>
              <CalendarClockIcon className="h-3.5 w-3.5 shrink-0" />
              {formatDate(deal.expectedCloseDate)}
            </p>
          )}
          {deal.ownerName && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="grid size-4 place-items-center rounded-full bg-primary/10 text-[8px] font-bold uppercase text-primary">
                {initials(deal.ownerName)}
              </span>
              {deal.ownerName}
            </p>
          )}
          {deal.source && (
            <Badge variant="outline" className="mt-2 text-[10px]">
              {LEAD_SOURCE_LABELS[deal.source] ?? deal.source}
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-60 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              onClick={(event) => event.stopPropagation()}
              title="Pindahkan deal ke tahap lain"
            >
              <GripVerticalIcon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Pindah ke tahap</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {otherStages.map((item) => {
              const itemColors = stageColorClasses(item.color);
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={(event) => event.stopPropagation()}
                  onSelect={(event) => {
                    event.stopPropagation();
                    onMove(deal.id, item.id);
                  }}
                  className="flex items-center gap-2"
                >
                  <span className={"size-2 rounded-full " + itemColors.dot} />
                  {item.name}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
