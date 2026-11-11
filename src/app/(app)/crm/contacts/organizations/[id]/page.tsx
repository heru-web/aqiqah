import { assertResourceAccess } from "@/lib/server/resource-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  Building2Icon,
  CircleDollarSignIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityDialog } from "@/components/crm/v2/activity-dialog";
import { ActivityList, type ActivityItem } from "@/components/crm/v2/activity-list";
import { DeleteContactButton } from "@/components/crm/v2/delete-contact-button";
import { NoteForm } from "@/components/crm/v2/note-form";
import { OrganizationDialog } from "@/components/crm/v2/organization-dialog";
import { stageColorClasses } from "@/lib/crm/crm";
import { formatDate, formatDateTime, formatIDR, initials } from "@/lib/utils";
import { requirePagePermission } from "@/lib/server/page-auth";
import {
  getCrmOrganizationDetail,
  listCrmUsers,
} from "@/server/services/crm";

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const { id } = await params;
  await assertResourceAccess("organization", id, user);
  const organization = await getCrmOrganizationDetail(id);
  if (!organization) notFound();

  const branchId = user.branchId ?? undefined;
  const users = await listCrmUsers(branchId);
  const userOptions = users.map((item) => ({ id: item.id, name: item.name }));

  const activityItems: ActivityItem[] = organization.activities.map((activity) => ({
    id: activity.id,
    type: activity.type as ActivityItem["type"],
    title: activity.title,
    notes: activity.notes,
    dueAt: activity.dueAt ? activity.dueAt.toISOString() : null,
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    ownerName: activity.ownerName,
  }));

  const openValue = organization.deals
    .filter((deal) => deal.stageType === "OPEN")
    .reduce((sum, deal) => sum + deal.value, 0n);

  return (
    <div>
      <PageHeader
        title={organization.name}
        description={`${organization.industry ?? "Perusahaan"}${organization.city ? ` · ${organization.city}` : ""} · ${
          organization.people.length
        } kontak`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm/contacts?tab=organizations">
                <ArrowLeftIcon className="h-4 w-4" /> Perusahaan
              </Link>
            </Button>
            <OrganizationDialog
              organization={{
                id: organization.id,
                name: organization.name,
                industry: organization.industry,
                phone: organization.phone,
                email: organization.email,
                city: organization.city,
                address: organization.address,
                ownerId: organization.ownerId,
                notes: organization.profileNotes,
              }}
              users={userOptions}
              trigger={
                <Button variant="outline">
                  <PencilIcon className="h-4 w-4" /> Ubah
                </Button>
              }
            />
            <DeleteContactButton id={organization.id} kind="organization" />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Kontak" value={String(organization.people.length)} />
        <MiniStat label="Total deal" value={String(organization.deals.length)} />
        <MiniStat label="Nilai terbuka" value={formatIDR(openValue)} />
        <MiniStat label="Aktivitas" value={String(organization.activities.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Deal</CardTitle>
              <CardDescription>Peluang penjualan untuk perusahaan ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {organization.deals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  Belum ada deal.{" "}
                  <Link href="/crm" className="font-semibold text-primary hover:underline">
                    Tambah dari pipeline
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-line/10">
                  {organization.deals.map((deal) => {
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
                            {deal.personName ?? "Tanpa PIC"}
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
            <CardHeader>
              <CardTitle>Kontak</CardTitle>
              <CardDescription>Orang-orang yang terhubung dengan perusahaan ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {organization.people.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  Belum ada kontak terhubung.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {organization.people.map((person) => (
                    <li key={person.id} className="rounded-xl border border-line/10 bg-surface px-3 py-2.5">
                      <Link
                        href={`/crm/contacts/people/${person.id}`}
                        className="text-[12.5px] font-semibold hover:text-primary hover:underline"
                      >
                        {person.name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {person.phone ?? person.email ?? "—"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {person.dealCount} deal · {formatIDR(person.openValue)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Aktivitas</CardTitle>
                <CardDescription>Follow-up untuk perusahaan ini.</CardDescription>
              </div>
              <ActivityDialog
                organizationId={organization.id}
                users={userOptions}
                defaultOwnerId={organization.ownerId ?? user.id}
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
              <NoteForm organizationId={organization.id} placeholder="Catatan tentang perusahaan ini…" />
              {organization.notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/20 px-3 py-5 text-center text-xs text-muted-foreground">
                  Belum ada catatan.
                </p>
              ) : (
                <ul className="space-y-2">
                  {organization.notes.map((note) => (
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
              <Info icon={<Building2Icon className="h-3.5 w-3.5" />} label="Nama">
                {organization.name}
              </Info>
              <Info icon={<PhoneIcon className="h-3.5 w-3.5" />} label="Telepon">
                {organization.phone ?? "—"}
              </Info>
              <Info icon={<MailIcon className="h-3.5 w-3.5" />} label="Email">
                {organization.email ?? "—"}
              </Info>
              <Info icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Kota">
                {organization.city ?? "—"}
              </Info>
              <Info icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Alamat">
                {organization.address ?? "—"}
              </Info>
              <Info icon={<CircleDollarSignIcon className="h-3.5 w-3.5" />} label="Pemilik">
                {organization.ownerName ?? "Belum ditugaskan"}
              </Info>
            </CardContent>
          </Card>

          {organization.profileNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Catatan Profil</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-[12.5px] text-foreground/80">{organization.profileNotes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Kontak Utama</CardTitle>
            </CardHeader>
            <CardContent>
              {organization.people.slice(0, 1).map((person) => (
                <div key={person.id} className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-[10px] font-bold uppercase text-primary">
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/crm/contacts/people/${person.id}`}
                      className="text-[12.5px] font-semibold hover:text-primary hover:underline"
                    >
                      {person.name}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{person.jobTitle ?? person.phone ?? "—"}</p>
                  </div>
                </div>
              ))}
              {organization.people.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada kontak.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">Dibuat {formatDate(organization.createdAt)}</Badge>
            <Badge variant="neutral">Diubah {formatDate(organization.updatedAt)}</Badge>
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
