import { requirePagePermission } from "@/lib/server/page-auth";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function PayablesPage() {
  await requirePagePermission("payables.payables.view");
  return (
    <div>
      <PageHeader title="Hutang" description="Hutang usaha & jatuh tempo." />
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Belum ada skema hutang terpisah saat ini.</CardContent>
      </Card>
    </div>
  );
}
