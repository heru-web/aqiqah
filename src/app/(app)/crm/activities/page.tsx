import Link from "next/link";
import { CalendarCheck2Icon, CalendarClockIcon, CalendarDaysIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ActivityDialog } from "@/components/crm/v2/activity-dialog";
import { ActivityList, type ActivityItem } from "@/components/crm/v2/activity-list";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/crm";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/lib/server/page-auth";
import { listCrmActivities, listCrmUsers, type CrmActivityType } from "@/server/services/crm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toItem(activity: {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  ownerName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  personName: string | null;
}): ActivityItem {
  return {
    id: activity.id,
    type: activity.type as ActivityItem["type"],
    title: activity.title,
    notes: activity.notes,
    dueAt: activity.dueAt ? activity.dueAt.toISOString() : null,
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    ownerName: activity.ownerName,
    dealId: activity.dealId,
    dealTitle: activity.dealTitle,
    personName: activity.personName,
  };
}

export default async function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const params = await searchParams;
  const rawTab = pick(params.tab);
  const tab = rawTab === "done" || rawTab === "all" ? rawTab : "open";
  const typeRaw = pick(params.type).toUpperCase();
  const type = typeRaw in ACTIVITY_TYPE_LABELS ? (typeRaw as CrmActivityType) : undefined;
  const branchId = user.branchId ?? undefined;

  const [all, users] = await Promise.all([
    listCrmActivities({ branchId }),
    listCrmUsers(branchId),
  ]);
  const userOptions = users.map((item) => ({ id: item.id, name: item.name }));

  const open = all.filter((activity) => !activity.completedAt);
  const done = all.filter((activity) => activity.completedAt);
  const filtered = all.filter((activity) => {
    if (tab === "open" && activity.completedAt) return false;
    if (tab === "done" && !activity.completedAt) return false;
    if (type && activity.type !== type) return false;
    return true;
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  const late = filtered.filter(
    (activity) => !activity.completedAt && activity.dueAt && activity.dueAt < todayStart
  );
  const today = filtered.filter(
    (activity) =>
      !activity.completedAt &&
      activity.dueAt &&
      activity.dueAt >= todayStart &&
      activity.dueAt < tomorrowStart
  );
  const tomorrow = filtered.filter(
    (activity) =>
      !activity.completedAt &&
      activity.dueAt &&
      activity.dueAt >= tomorrowStart &&
      activity.dueAt < addDays(tomorrowStart, 1)
  );
  const thisWeek = filtered.filter(
    (activity) =>
      !activity.completedAt &&
      activity.dueAt &&
      activity.dueAt >= addDays(tomorrowStart, 1) &&
      activity.dueAt < weekEnd
  );
  const later = filtered.filter(
    (activity) => !activity.completedAt && activity.dueAt && activity.dueAt >= weekEnd
  );
  const noSchedule = filtered.filter((activity) => !activity.completedAt && !activity.dueAt);
  const completed = filtered.filter((activity) => activity.completedAt);

  const groups: Array<{ key: string; title: string; hint: string; items: typeof filtered }> = [];
  if (tab !== "done") {
    if (late.length) groups.push({ key: "late", title: "Terlambat", hint: "Lewat dari jadwal", items: late });
    if (today.length) groups.push({ key: "today", title: "Hari ini", hint: "Segera ditindaklanjuti", items: today });
    if (tomorrow.length) groups.push({ key: "tomorrow", title: "Besok", hint: "Persiapan awal", items: tomorrow });
    if (thisWeek.length) groups.push({ key: "week", title: "Minggu ini", hint: "7 hari ke depan", items: thisWeek });
    if (later.length) groups.push({ key: "later", title: "Nanti", hint: "Jadwal mendatang", items: later });
    if (noSchedule.length) groups.push({ key: "none", title: "Tanpa jadwal", hint: "Belum ditentukan", items: noSchedule });
  }
  if (tab !== "open" && completed.length) {
    groups.push({ key: "done", title: "Selesai", hint: "Sudah dikerjakan", items: completed });
  }

  const hrefFor = (nextTab: string) =>
    `/crm/activities?tab=${nextTab}${type ? `&type=${type}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Aktivitas"
        description={`${open.length} aktivitas terbuka · ${late.length} terlambat · ${today.length} hari ini.`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm">Pipeline</Link>
            </Button>
            <ActivityDialog
              users={userOptions}
              defaultOwnerId={user.id}
              trigger={
                <Button>
                  <PlusIcon className="h-4 w-4" /> Aktivitas Baru
                </Button>
              }
            />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<TriangleAlertIcon className="h-4 w-4 text-danger" />}
          label="Terlambat"
          value={String(open.filter((activity) => activity.dueAt && activity.dueAt < todayStart).length)}
        />
        <StatCard
          icon={<CalendarClockIcon className="h-4 w-4 text-gold" />}
          label="Hari ini"
          value={String(open.filter((activity) => activity.dueAt && activity.dueAt >= todayStart && activity.dueAt < tomorrowStart).length)}
        />
        <StatCard
          icon={<CalendarDaysIcon className="h-4 w-4 text-primary" />}
          label="Terbuka"
          value={String(open.length)}
        />
        <StatCard
          icon={<CalendarCheck2Icon className="h-4 w-4 text-success" />}
          label="Selesai"
          value={String(done.length)}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-line/10 bg-subtle p-1 text-[12px] font-semibold">
          {[
            { key: "open", label: `Terbuka (${open.length})` },
            { key: "done", label: `Selesai (${done.length})` },
            { key: "all", label: "Semua" },
          ].map((item) => (
            <Link
              key={item.key}
              href={hrefFor(item.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 transition",
                tab === item.key ? "bg-surface text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <form action="/crm/activities" method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <Select name="type" defaultValue={type ?? ""} className="h-9 w-40">
            <option value="">Semua jenis</option>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="compact">
            Terapkan
          </Button>
        </form>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-headline-sm text-foreground">Tidak ada aktivitas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tab === "done" ? "Belum ada aktivitas yang diselesaikan." : "Semua aktivitas sudah beres."}
            </p>
            <div className="mt-4 flex justify-center">
              <ActivityDialog
                users={userOptions}
                defaultOwnerId={user.id}
                trigger={<Button variant="outline">Tambah Aktivitas</Button>}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="font-headline-sm text-foreground">{group.title}</h2>
                <Badge variant={group.key === "late" ? "danger" : "neutral"}>{group.items.length}</Badge>
                <span className="text-[11px] text-muted-foreground">{group.hint}</span>
              </div>
              <ActivityList items={group.items.map(toItem)} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 p-3.5">
        <span className="grid size-8 place-items-center rounded-lg bg-muted">{icon}</span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-lg font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
