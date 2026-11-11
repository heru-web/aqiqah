import { assertResourceAccess } from "@/lib/server/resource-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  Building2Icon,
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
import { DeleteContactButton } from "@/components/crm/v2/delete-contact-button";
import { NoteForm } from "@/components/crm/v2/note-form";
import { PersonDialog } from "@/components/crm/v2/person-dialog";
import { stageColorClasses } from "@/lib/crm/crm";
import { formatDate, formatDateTime, formatIDR } from "@/lib/utils";
import { requirePagePermission } from "@/lib/server/page-auth";
import {
  getCrmPersonDetail,
  listCrmOrganizations,
  listCrmUsers,
} from "@/server/services/crm";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const { id } = await params;
  await assertResourceAccess("person", id, user);
  const person = await getCrmPersonDetail(id);
  if (!person) notFound();

  const branchId = user.branchId ?? undefined;
  const [organizations, users] = await Promise.all([
    listCrmOrganizations({ branchId }),
    listCrmUsers(branchId),
  ]);

  const userOptions = users.map((item) => ({ id: item.id, name: item.name }));
  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));

  const activityItems: ActivityItem[] = person.activities.map((activity) => ({
    id: activity.id,
    type: activity.type as ActivityItem["type"],
    title: activity.title,
    notes: activity.notes,
    dueAt: activity.dueAt ? activity.dueAt.toISOString() : null,
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    ownerName: activity.ownerName,
  }));

  const openValue = person.deals
    .filter((deal) => deal.stageType === "OPEN")
    .reduce((sum, deal) => sum + deal.value, 0n);
  const whatsapp = person.whatsapp ?? person.phone;

  return (
    <div>
      <PageHeader
        title={person.name}
        description={`${person.jobTitle ? `${person.jobTitle} · ` : ""}${
          person.organizationName ?? "Kontak perorangan"
        }`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm/contacts">
                <ArrowLeftIcon className="h-4 w-4" /> Kontak
              </Link>
            </Button>
            {whatsapp && (
              <Button asChild variant="secondary">
                <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            <PersonDialog
              person={{
                id: person.id,
                name: person.name,
                phone: person.phone,
                whatsapp: person.whatsapp,
                email: person.email,
                jobTitle: person.jobTitle,
                city: person.city,
                organizationId: person.organizationId,
                ownerId: person.ownerId,
                notes: person.profileNotes,
              }}
              organizations={organizationOptions}
              users={userOptions}
              trigger={
                <Button variant="outline">
                  <PencilIcon className="h-4 w-4" /> Ubah
                </Button>
              }
            />
            <DeleteContactButton id={person.id} kind="person" />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Total deal" value={String(person.deals.length)} />
        <MiniStat label="Nilai terbuka" value={formatIDR(openValue)} />
        <MiniStat label="Aktivitas" value={String(person.activities.length)} />
        <MiniStat label="Catatan" value={String(person.notes.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Deal</CardTitle>
              <CardDescription>Semua peluang yang terhubung dengan kontak ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {person.deals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  Belum ada deal.{" "}
                  <Link href="/crm" className="font-semibold text-primary hover:underline">
                    Tambah dari pipeline
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-line/10">
                  {person.deals.map((deal) => {
                    const colors = stageColorClasses(deal.stageColor);
                    return (
                      <li key={deal.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <Link href={`/crm/deals/${deal.id}`} className="text-[13px] font-semibold hover:text-primary hover:underline">
                            {deal.title}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className={`rounded-full px-1.5 py-0.5 font-semibold ${colors.soft} ${colors.text}`}>
                              {deal.stageName}
                            </span>
                            {deal.expectedCloseDate ? `Target ${formatDate(deal.expectedCloseDate)}` : "Tanpa target"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums">{formatIDR(deal.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Aktivitas</CardTitle>
                <CardDescription>Follow-up untuk kontak ini.</CardDescription>
              </div>
              <ActivityDialog
                personId={person.id}
                organizationId={person.organizationId ?? undefined}
                users={userOptions}
                defaultOwnerId={person.ownerId ?? user.id}
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
            </CardHeader>
            <CardContent className="space-y-3">
              <NoteForm personId={person.id} placeholder="Catatan tentang kontak ini…" />
              {person.notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-5 text-center text-xs text-muted-foreground">
                  Belum ada catatan.
                </p>
              ) : (
                <ul className="space-y-2">
                  {person.notes.map((note) => (
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
              <CardTitle>Informasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              <Info icon={<UserRoundIcon className="h-3.5 w-3.5" />} label="Nama">
                {person.name}
              </Info>
              <Info icon={<PhoneIcon className="h-3.5 w-3.5" />} label="Telepon">
                {person.phone ?? "—"}
              </Info>
              <Info icon={<MessageCircleIcon className="h-3.5 w-3.5" />} label="WhatsApp">
                {person.whatsapp ?? "—"}
              </Info>
              <Info icon={<MailIcon className="h-3.5 w-3.5" />} label="Email">
                {person.email ?? "—"}
              </Info>
              <Info icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Kota">
                {person.city ?? "—"}
              </Info>
              <Info icon={<Building2Icon className="h-3.5 w-3.5" />} label="Perusahaan">
                {person.organizationId ? (
                  <Link
                    href={`/crm/contacts/organizations/${person.organizationId}`}
                    className="text-primary hover:underline"
                  >
                    {person.organizationName}
                  </Link>
                ) : (
                  "—"
                )}
              </Info>
              <Info icon={<CircleDollarSignIcon className="h-3.5 w-3.5" />} label="Pemilik">
                {person.ownerName ?? "Belum ditugaskan"}
              </Info>
            </CardContent>
          </Card>

          {person.profileNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Catatan Profil</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-[12.5px] text-foreground/80">{person.profileNotes}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">Dibuat {formatDate(person.createdAt)}</Badge>
            <Badge variant="neutral">Diubah {formatDate(person.updatedAt)}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-lg font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
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
