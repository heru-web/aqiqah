import { assertResourceAccess } from "@/lib/server/resource-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  HistoryIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditLeadDialog } from "@/components/crm/lead-form-dialog";
import { LeadStatusActions } from "@/components/crm/lead-status-actions";
import { LeadFollowupPanel, type FollowupItem } from "@/components/crm/lead-followup-panel";
import { LEAD_STAGE_LABELS, LEAD_STAGE_META, LEAD_STAGES, leadStageIndex, type LeadStage } from "@/lib/crm/pipeline";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getLeadDetail, listAssignableUsers } from "@/server/services/leads";
import { formatDate, formatDateTime, formatIDR } from "@/lib/utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function activityLabel(action: string, before: unknown, after: unknown): string {
  if (action === "CREATE") return "Lead dibuat";
  if (action === "TRANSITION") {
    const from = asRecord(before)?.status;
    const to = asRecord(after)?.status;
    const reason = asRecord(after)?.reason;
    const fromLabel = typeof from === "string" ? LEAD_STAGE_LABELS[from as LeadStage] ?? from : "?";
    const toLabel = typeof to === "string" ? LEAD_STAGE_LABELS[to as LeadStage] ?? to : "?";
    return `Status ${fromLabel} → ${toLabel}${typeof reason === "string" && reason ? ` · ${reason}` : ""}`;
  }
  if (action === "UPDATE") return "Data lead diperbarui";
  if (action === "DELETE") return "Lead dihapus";
  return action;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const { id } = await params;
  await assertResourceAccess("lead", id, user);
  const [detail, owners] = await Promise.all([
    getLeadDetail(id, { branchId: user.branchId ?? undefined }),
    listAssignableUsers(user.branchId ?? undefined),
  ]);

  if (!detail) notFound();
  const { lead, followups, activities } = detail;
  const status = lead.status as LeadStage;
  const currentIndex = leadStageIndex(status);
  const closed = status === "CLOSED";

  const followupItems: FollowupItem[] = followups.map((item) => ({
    id: item.id,
    method: item.method,
    summary: item.summary,
    dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
    status: item.status,
    completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
    agentName: item.agentName,
    createdAt: new Date(item.createdAt).toISOString(),
  }));

  const whatsapp = lead.whatsapp ?? lead.phone;
  const leadFormData = {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    company: lead.company,
    city: lead.city,
    source: lead.source,
    productInterest: lead.productInterest,
    budget: lead.budget != null ? lead.budget.toString() : null,
    notes: lead.notes,
    assignedTo: lead.assignedTo,
    nextFollowupAt: lead.nextFollowupAt,
  };

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={[lead.company, lead.city].filter(Boolean).join(" · ") || "Lead CRM"}
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
            <EditLeadDialog lead={leadFormData} owners={owners} currentUserId={user.id} />
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge kind="lead" status={status} />
              <Badge variant="gold">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</Badge>
              {lead.productInterest && <Badge variant="neutral">{lead.productInterest}</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">
              {lead.ownerName ? `Pemilik: ${lead.ownerName}` : "Belum ada pemilik"}
            </span>
          </div>
          <div className="flex items-stretch gap-1.5">
            {LEAD_STAGES.map((stage, index) => {
              const done = closed || index < currentIndex;
              const current = !closed && index === currentIndex;
              return (
                <div key={stage} className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      done ? "bg-primary" : current ? "bg-gold" : "bg-line/25"
                    }`}
                  />
                  <p
                    className={`mt-1.5 truncate text-center text-[10px] font-semibold ${
                      current ? "text-foreground" : "text-muted-foreground"
                    }`}
                    title={LEAD_STAGE_META[stage].description}
                  >
                    {LEAD_STAGE_META[stage].label}
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
            <CardHeader>
              <CardTitle>Informasi Lead</CardTitle>
              <CardDescription>Data kontak dan kebutuhan calon pelanggan.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem
                label="Telepon"
                value={
                  lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <PhoneIcon className="h-3.5 w-3.5" /> {lead.phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem
                label="WhatsApp"
                value={
                  lead.whatsapp ? (
                    <a
                      href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <MessageCircleIcon className="h-3.5 w-3.5" /> {lead.whatsapp}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem
                label="Email"
                value={
                  lead.email ? (
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <MailIcon className="h-3.5 w-3.5" /> {lead.email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem
                label="Kota"
                value={
                  lead.city ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" /> {lead.city}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem label="Perusahaan" value={lead.company ?? "—"} />
              <InfoItem label="Pelanggan terkait" value={lead.customerName ? `${lead.customerName} (${lead.customerCode})` : "—"} />
              <InfoItem
                label="Kisaran budget"
                value={
                  lead.budget != null ? (
                    <span className="inline-flex items-center gap-1.5 font-data">
                      <CircleDollarSignIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatIDR(lead.budget)}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem
                label="Follow-up berikutnya"
                value={
                  lead.nextFollowupAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateTime(lead.nextFollowupAt)}
                    </span>
                  ) : (
                    "Belum dijadwalkan"
                  )
                }
              />
              <InfoItem label="Dibuat" value={formatDateTime(lead.createdAt)} />
              <InfoItem label="Terakhir diubah" value={formatDateTime(lead.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up</CardTitle>
              <CardDescription>Catat agenda, lalu tandai selesai setelah dihubungi.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadFollowupPanel leadId={lead.id} followups={followupItems} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4" /> Aktivitas
              </CardTitle>
              <CardDescription>Jejak audit perubahan status dan data lead.</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line/15 py-6 text-center text-xs text-muted-foreground">
                  Belum ada aktivitas tercatat.
                </p>
              ) : (
                <ol className="space-y-3">
                  {activities.map((activity) => (
                    <li key={activity.id} className="flex gap-2.5">
                      <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-line/10">
                        <SparklesIcon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {activityLabel(activity.action, activity.before, activity.after)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {activity.actorName ?? "Sistem"} · {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundIcon className="h-4 w-4" /> Status & Pemilik
              </CardTitle>
              <CardDescription>Perbarui tahap pipeline dan penanggung jawab.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadStatusActions
                key={status}
                leadId={lead.id}
                status={status}
                assignedTo={lead.assignedTo}
                owners={owners}
                closedReason={lead.closedReason}
              />
            </CardContent>
          </Card>

          {closed && (
            <Card>
              <CardHeader>
                <CardTitle>Hasil Penutupan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <InfoItem label="Ditutup" value={lead.closedAt ? formatDateTime(lead.closedAt) : "—"} />
                <InfoItem label="Alasan" value={lead.closedReason ?? "—"} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
              <CardDescription>Konteks internal untuk tim sales.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">
                {lead.notes?.trim() || "Belum ada catatan."}
              </p>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Diperbarui {formatDate(lead.updatedAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-label-sm text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
