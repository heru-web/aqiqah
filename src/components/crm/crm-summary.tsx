import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatIDRShort, formatPercent } from "@/lib/utils";
import type { CrmSummary } from "@/server/services/leads";

interface SummaryItem {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: "default" | "danger" | "success";
}

export function CrmSummaryCards({ summary }: { summary: CrmSummary }) {
  const items: SummaryItem[] = [
    {
      label: "Lead aktif",
      value: String(summary.open),
      sub: `${summary.total} total · ${summary.unassigned} belum ditugaskan`,
      icon: <UsersIcon className="h-5 w-5" />,
    },
    {
      label: "Nilai pipeline",
      value: formatIDRShort(summary.pipelineValue),
      sub: "Akumulasi budget lead aktif",
      icon: <CircleDollarSignIcon className="h-5 w-5" />,
    },
    {
      label: "Follow-up hari ini",
      value: String(summary.dueToday),
      sub: "Jadwal yang harus disentuh",
      icon: <CalendarClockIcon className="h-5 w-5" />,
    },
    {
      label: "Terlambat",
      value: String(summary.overdue),
      sub: summary.overdue > 0 ? "Perlu tindakan segera" : "Tidak ada yang telat",
      icon: <AlertTriangleIcon className="h-5 w-5" />,
      tone: summary.overdue > 0 ? "danger" : "success",
    },
    {
      label: "Konversi",
      value: summary.conversion === null ? "—" : formatPercent(summary.conversion),
      sub: `${summary.closed} lead selesai`,
      icon: <TrendingUpIcon className="h-5 w-5" />,
    },
    {
      label: "Lead baru",
      value: String(summary.newLeads),
      sub: "Belum dihubungi — prioritaskan kontak pertama",
      icon: <TargetIcon className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-label-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-xl font-bold leading-none tracking-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-muted-foreground">
                {item.sub}
              </p>
            </div>
            <div
              className={
                item.tone === "danger"
                  ? "grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger-soft-foreground ring-1 ring-danger/15"
                  : item.tone === "success"
                    ? "grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success-soft-foreground ring-1 ring-success/15"
                    : "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-line/10"
              }
            >
              {item.icon}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
