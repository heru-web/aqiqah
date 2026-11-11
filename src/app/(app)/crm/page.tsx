import Link from "next/link";
import { ArrowRightIcon, CalendarClockIcon, CircleDollarSignIcon, PlusIcon, TargetIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DealTable } from "@/components/crm/v2/deal-table";
import { DealDialog } from "@/components/crm/v2/deal-dialog";
import { CrmToolbar } from "@/components/crm/v2/crm-toolbar";
import { CrmBoardClient } from "./crm-board-client";
import { cn, formatIDRShort } from "@/lib/utils";
import { requirePagePermission } from "@/lib/server/page-auth";
import {
  ensureDefaultPipeline,
  getCrmOverview,
  listCrmDeals,
  listCrmOrganizations,
  listCrmPeople,
  listCrmUsers,
} from "@/server/services/crm";
import type { DealCardData, StageData } from "@/components/crm/v2/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CrmPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const params = await searchParams;

  const q = pick(params.q).slice(0, 100);
  const stageId = pick(params.stage) || undefined;
  const owner = pick(params.owner) || undefined;
  const statusRaw = pick(params.status).toUpperCase();
  const status = ["OPEN", "WON", "LOST"].includes(statusRaw)
    ? (statusRaw as "OPEN" | "WON" | "LOST")
    : "ALL";
  const view = pick(params.view) === "table" ? "table" : "board";

  const branchId = user.branchId ?? undefined;
  const { stages } = await ensureDefaultPipeline(branchId);
  const [deals, overview, users, people, organizations] = await Promise.all([
    listCrmDeals({
      branchId,
      search: q || undefined,
      stageId,
      ownerId: owner === "UNASSIGNED" ? "UNASSIGNED" : owner || undefined,
      status,
    }),
    getCrmOverview(branchId),
    listCrmUsers(branchId),
    listCrmPeople({ branchId }),
    listCrmOrganizations({ branchId }),
  ]);

  const stageData: StageData[] = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    color: stage.color,
    type: stage.type,
    position: stage.position,
  }));

  const cards: DealCardData[] = deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    value: deal.value.toString(),
    source: deal.source,
    productInterest: deal.productInterest,
    stageId: deal.stageId,
    stageType: deal.stageType,
    personId: deal.personId,
    personName: deal.personName,
    personPhone: deal.personPhone,
    personWhatsapp: deal.personWhatsapp,
    organizationId: deal.organizationId,
    organizationName: deal.organizationName,
    ownerId: deal.ownerId,
    ownerName: deal.ownerName,
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.toISOString() : null,
    closedAt: deal.closedAt ? deal.closedAt.toISOString() : null,
    lostReason: deal.lostReason,
    notes: deal.notes,
  }));

  const personOptions = people.map((person) => ({
    id: person.id,
    name: person.name,
    organizationName: person.organizationName,
  }));
  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));
  const userOptions = users.map((item) => ({ id: item.id, name: item.name }));

  const hasFilter = Boolean(q || stageId || owner || status !== "ALL");

  return (
    <div>
      <PageHeader
        title="CRM"
        description={"Pipeline penjualan · " + overview.open + " deal berjalan · " + formatIDRShort(overview.pipelineValue) + " potensi."}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/crm/contacts">
                <UsersIcon className="h-4 w-4" /> Kontak
              </Link>
            </Button>
            <DealDialog
              stages={stageData}
              people={personOptions}
              organizations={organizationOptions}
              users={userOptions}
              defaultStageId={stages.find((stage) => stage.type === "OPEN")?.id}
              trigger={
                <Button>
                  <PlusIcon className="h-4 w-4" /> Deal Baru
                </Button>
              }
            />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<CircleDollarSignIcon className="h-4 w-4 text-primary" />}
          label="Nilai pipeline"
          value={formatIDRShort(overview.pipelineValue)}
          hint={overview.open + " deal berjalan"}
        />
        <SummaryCard
          icon={<TrendingUpIcon className="h-4 w-4 text-success" />}
          label="Jadi pesanan"
          value={formatIDRShort(overview.wonValue)}
          hint={overview.won + " pesanan masuk"}
        />
        <SummaryCard
          icon={<TargetIcon className="h-4 w-4 text-gold" />}
          label="Konversi"
          value={overview.conversion == null ? "—" : Math.round(overview.conversion * 100) + "%"}
          hint={overview.lost + " pesanan batal"}
        />
        <SummaryCard
          icon={<CalendarClockIcon className="h-4 w-4 text-danger" />}
          label="Aktivitas terlambat"
          value={String(overview.dueActivities)}
          hint="Perlu ditindaklanjuti"
          href="/crm/activities"
        />
      </div>

      <CrmToolbar
        initial={{ q, stage: stageId ?? "", owner: owner ?? "", status, view }}
        stages={stageData}
        users={userOptions}
      />

      {cards.length === 0 ? (
        <EmptyState
          title={hasFilter ? "Tidak ada deal yang cocok" : "Pipeline masih kosong"}
          description={
            hasFilter
              ? "Ubah kata kunci atau filter untuk melihat deal lain."
              : "Mulai dari satu potensi pesanan. Setiap peluang bisa dipantau sampai jadi pesanan atau batal."
          }
          action={
            hasFilter ? (
              <Button asChild variant="outline">
                <Link href="/crm">Hapus filter</Link>
              </Button>
            ) : (
              <DealDialog
                stages={stageData}
                people={personOptions}
                organizations={organizationOptions}
                users={userOptions}
                defaultStageId={stages.find((stage) => stage.type === "OPEN")?.id}
                trigger={
                  <Button>
                    <PlusIcon className="h-4 w-4" /> Deal Baru
                  </Button>
                }
              />
            )
          }
        />
      ) : view === "table" ? (
        <DealTable deals={cards} stages={stageData} />
      ) : (
        <CrmBoardClient
          stages={stageData}
          deals={cards}
          people={personOptions}
          organizations={organizationOptions}
          users={userOptions}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge variant="outline">Adaptasi modul Pipelite</Badge>
        <span className="text-[11px] text-muted-foreground">
          Pipeline, kontak, aktivitas, dan catatan tersimpan di tabel CRM baru.
        </span>
        <Button asChild variant="ghost" size="compact" className="ml-auto h-7 text-[11px]">
          <Link href="/crm/pengaturan">Kelola tahap pipeline</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const card = (
    <Card className={cn(href && "transition hover:-translate-y-0.5 hover:border-primary/30")}>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-muted">{icon}</span>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {href && <ArrowRightIcon className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />}
        </div>
        <p className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} aria-label={`Buka ${label.toLowerCase()}`} className="block">
      {card}
    </Link>
  );
}
