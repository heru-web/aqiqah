import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  Building2Icon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityDialog } from "@/components/crm/v2/activity-dialog";
import { ActivityList, type ActivityItem } from "@/components/crm/v2/activity-list";
import { DealDialog } from "@/components/crm/v2/deal-dialog";
import { DeleteDealButton } from "@/components/crm/v2/delete-deal-button";
import { NoteForm } from "@/components/crm/v2/note-form";
import { formatDate, formatDateTime, formatIDR, initials } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { stageColorClasses } from "@/lib/crm/crm";
import { requirePagePermission } from "@/lib/server/page-auth";
import {
  ensureDefaultPipeline,
  getCrmDealDetail,
  listCrmOrganizations,
  listCrmPeople,
  listCrmUsers,
} from "@/server/services/crm";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const { id } = await params;
  const detail = await getCrmDealDetail(id, user.branchId ?? undefined);
  if (!detail) notFound();

  const branchId = user.branchId ?? undefined;
  const [{ stages }, people, organizations, users] = await Promise.all([
    ensureDefaultPipeline(branchId),
    listCrmPeople({ branchId }),
    listCrmOrganizations({ branchId }),
    listCrmUsers(branchId),
  ]);

  const stageData = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    color: stage.color,
    type: stage.type,
    position: stage.position,
  }));

  const cardData = {
    id: detail.id,
    title: detail.title,
    value: detail.value.toString(),
    source: detail.source,
    productInterest: detail.productInterest,
    stageId: detail.stageId,
    stageType: detail.stage.type,
    personId: detail.personId,
    personName: detail.person?.name ?? null,
    personPhone: detail.person?.phone ?? null,
    personWhatsapp: detail.person?.whatsapp ?? null,
    organizationId: detail.organizationId,
    organizationName: detail.organization?.name ?? null,
    ownerId: detail.ownerId,
    ownerName: detail.ownerName,
    expectedCloseDate: detail.expectedCloseDate ? detail.expectedCloseDate.toISOString() : null,
    closedAt: detail.closedAt ? detail.closedAt.toISOString() : null,
    lostReason: detail.lostReason,
    notes: detail.profileNotes,
  };

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

  const activityItems: ActivityItem[] = detail.activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    notes: activity.notes,
    dueAt: activity.dueAt ? activity.dueAt.toISOString() : null,
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    ownerName: activity.ownerName,
  }));

  const colors = stageColorClasses(detail.stage.color);
  const whatsapp = detail.person?.whatsapp ?? detail.person?.phone;
  const currentIndex = stages.findIndex((stage) => stage.id === detail.stageId);

  return (
    <div>
      <PageHeader
        title={detail.title}
        description={`${detail.person?.name ?? "Tanpa kontak"}${
          detail.organization?.name ? ` · ${detail.organization.name}` : ""
        } · ${detail.ownerName ?? "Belum ada pemilik"}`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm">
                <ArrowLeftIcon className="h-4 w-4" /> Pipeline
              </Link>
            </Button>
            {whatsapp && (
              <Button asChild variant="secondary">
                <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            <DealDialog
              deal={cardData}
              stages={stageData}
              people={personOptions}
              organizations={organizationOptions}
              users={userOptions}
              trigger={
                <Button variant="outline">
                  <PencilIcon className="h-4 w-4" /> Ubah
                </Button>
              }
            />
            <DeleteDealButton dealId={detail.id} />
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors.soft} ${colors.text}`}>
                <span className={`size-1.5 rounded-full ${colors.dot}`} />
                {detail.stage.name}
              </span>
              <Badge variant="success">{formatIDR(detail.value)}</Badge>
              {detail.source && (
                <Badge variant="gold">{LEAD_SOURCE_LABELS[detail.source] ?? detail.source}</Badge>
              )}
              {detail.productInterest && <Badge variant="neutral">{detail.productInterest}</Badge>}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {detail.expectedCloseDate ? `Target tutup ${formatDate(detail.expectedCloseDate)}` : "Tanpa target tutup"}
            </span>
          </div>

          <div className="flex items-stretch gap-1.5">
            {stages.map((stage, index) => {
              const done = index < currentIndex;
              const current = index === currentIndex;
              return (
                <div key={stage.id} className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      done ? "bg-primary" : current ? stageColorClasses(stage.color).bar : "bg-line/25"
                    }`}
                  />
                  <p
                    className={`mt-1.5 truncate text-center text-[10px] font-semibold ${
                      current ? "text-foreground" : "text-muted-foreground"
                    }`}
                    title={stage.description ?? undefined}
                  >
                    {stage.name}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Aktivitas</CardTitle>
                <CardDescription>Follow-up dan tugas untuk deal ini.</CardDescription>
              </div>
              <ActivityDialog
                dealId={detail.id}
                personId={detail.personId ?? undefined}
                organizationId={detail.organizationId ?? undefined}
                users={userOptions}
                defaultOwnerId={detail.ownerId ?? user.id}
                trigger={<Button size="compact">Tambah</Button>}
              />
            </CardHeader>
            <CardContent>
              <ActivityList items={activityItems} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
              <CardDescription>Riwayat percakapan dan informasi penting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <NoteForm dealId={detail.id} placeholder="Tulis hasil follow-up, preferensi, atau catatan internal…" />
              {detail.notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-5 text-center text-xs text-muted-foreground">
                  Belum ada catatan.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.notes.map((note) => (
                    <li key={note.id} className="rounded-xl border border-line/10 bg-surface px-3 py-2.5">
                      <p className="whitespace-pre-line text-[12.5px] text-foreground/85">{note.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {note.authorName ?? "Sistem"} · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              {detail.person ? (
                <>
                  <Info icon={<UserRoundIcon className="h-3.5 w-3.5" />} label="Nama">
                    <Link href={`/crm/contacts/people/${detail.person.id}`} className="text-primary hover:underline">
                      {detail.person.name}
                    </Link>
                  </Info>
                  <Info icon={<PhoneIcon className="h-3.5 w-3.5" />} label="Telepon">
                    {detail.person.phone ?? "—"}
                  </Info>
                  <Info icon={<MessageCircleIcon className="h-3.5 w-3.5" />} label="WhatsApp">
                    {detail.person.whatsapp ?? "—"}
                  </Info>
                  <Info icon={<MailIcon className="h-3.5 w-3.5" />} label="Email">
                    {detail.person.email ?? "—"}
                  </Info>
                  <Info icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Kota">
                    {detail.person.city ?? "—"}
                  </Info>
                </>
              ) : (
                <p className="text-muted-foreground">Belum ada kontak orang.</p>
              )}

              <div className="border-t border-line/10 pt-3">
                <Info icon={<Building2Icon className="h-3.5 w-3.5" />} label="Perusahaan">
                  {detail.organization ? (
                    <Link
                      href={`/crm/contacts/organizations/${detail.organization.id}`}
                      className="text-primary hover:underline"
                    >
                      {detail.organization.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Info>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              <Info icon={<CircleDollarSignIcon className="h-3.5 w-3.5" />} label="Nilai">
                {formatIDR(detail.value)}
              </Info>
              <Info icon={<CalendarClockIcon className="h-3.5 w-3.5" />} label="Target tutup">
                {detail.expectedCloseDate ? formatDate(detail.expectedCloseDate) : "—"}
              </Info>
              <Info icon={<UserRoundIcon className="h-3.5 w-3.5" />} label="Pemilik">
                <span className="inline-flex items-center gap-1.5">
                  <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[8px] font-bold uppercase text-primary">
                    {initials(detail.ownerName)}
                  </span>
                  {detail.ownerName ?? "Belum ditugaskan"}
                </span>
              </Info>
              <Info icon={<CalendarClockIcon className="h-3.5 w-3.5" />} label="Dibuat">
                {formatDateTime(detail.createdAt)}
              </Info>
              {detail.lostReason && (
                <Info icon={<CalendarClockIcon className="h-3.5 w-3.5" />} label="Alasan batal">
                  {detail.lostReason}
                </Info>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat Tahap</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
              ) : (
                <ol className="space-y-2">
                  {detail.history.slice(0, 8).map((item) => (
                    <li key={item.id} className="border-l-2 border-line/20 pl-2.5">
                      <p className="text-[12px] font-medium">
                        {item.fromName ? `${item.fromName} → ` : ""}
                        {item.reason ?? "Perubahan tahap"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.changedByName ?? "Sistem"} · {formatDateTime(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-foreground/85">{children}</div>
      </div>
    </div>
  );
}
