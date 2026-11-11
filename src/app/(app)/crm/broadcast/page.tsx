import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BroadcastForm } from "@/components/crm/v2/broadcast-form";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/server/page-auth";
import { listCrmPeople } from "@/server/services/crm";

export default async function CrmBroadcastPage() {
  const user = await requirePagePermission("crm.pipeline.view");
  const branchId = user.branchId ?? undefined;
  const people = await listCrmPeople({ branchId });

  return (
    <div>
      <PageHeader
        title="Broadcast WhatsApp"
        description="Kirim pesan WA ke daftar kontak CRM. Setiap nomor dikirim via gateway dan tercatat sebagai aktivitas WhatsApp."
      />
      <BroadcastForm people={people} />
      <div className="mt-4 flex justify-end">
        <Button asChild variant="outline">
          <Link href="/crm/activities">Lihat Aktivitas WhatsApp</Link>
        </Button>
      </div>
    </div>
  );
}
