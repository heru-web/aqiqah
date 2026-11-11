"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/data-table";
import { formatDate, formatIDR, initials } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { stageColorClasses } from "@/lib/crm/crm";
import type { DealCardData, StageData } from "./types";

export function DealTable({ deals, stages }: { deals: DealCardData[]; stages: StageData[] }) {
  const stageMap = new Map(stages.map((stage) => [stage.id, stage]));

  return (
    <DataTable
      rows={deals}
      rowKey={(deal) => deal.id}
      unit="deal"
      showIndex
      columns={[
        {
          key: "deal",
          header: "Deal",
          cell: (deal) => (
            <div className="min-w-0">
              <Link href={`/crm/deals/${deal.id}`} className="font-semibold text-foreground hover:text-primary">
                {deal.title}
              </Link>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {[deal.personName, deal.organizationName].filter(Boolean).join(" · ") || "Tanpa kontak"}
              </p>
            </div>
          ),
        },
        {
          key: "stage",
          header: "Tahap",
          cell: (deal) => {
            const stage = stageMap.get(deal.stageId);
            const colors = stageColorClasses(stage?.color);
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${colors.soft} ${colors.text}`}>
                <span className={`size-1.5 rounded-full ${colors.dot}`} />
                {stage?.name ?? "—"}
              </span>
            );
          },
        },
        {
          key: "value",
          header: "Nilai",
          align: "right",
          cell: (deal) => <span className="font-mono text-[12px] font-semibold">{formatIDR(deal.value)}</span>,
        },
        {
          key: "source",
          header: "Sumber",
          cell: (deal) =>
            deal.source ? (
              <Badge variant="gold">{LEAD_SOURCE_LABELS[deal.source] ?? deal.source}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          key: "owner",
          header: "Pemilik",
          cell: (deal) =>
            deal.ownerName ? (
              <span className="inline-flex items-center gap-1.5 text-[12px]">
                <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[9px] font-bold uppercase text-primary">
                  {initials(deal.ownerName)}
                </span>
                {deal.ownerName}
              </span>
            ) : (
              <span className="text-muted-foreground">Belum ada</span>
            ),
        },
        {
          key: "close",
          header: "Penutupan",
          cell: (deal) => (
            <span className="text-[12px] text-muted-foreground">
              {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"}
            </span>
          ),
        },
        {
          key: "action",
          header: "",
          align: "right",
          cell: (deal) => (
            <Button asChild variant="ghost" size="compact" className="h-7 px-2">
              <Link href={`/crm/deals/${deal.id}`} title="Buka deal">
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ),
        },
      ]}
    />
  );
}
