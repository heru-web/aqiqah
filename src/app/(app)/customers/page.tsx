import { SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerDataTable } from "@/components/customers/customer-data-table";
import { CustomerImportExtra } from "@/components/customers/customer-export-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { listCustomers } from "@/server/services/customers";
import { requirePagePermission } from "@/lib/server/page-auth";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requirePagePermission("customers.customers.view");
  const { q, page: rawPage } = await searchParams;
  const page = Math.max(1, Math.min(1_000_000, Math.trunc(Number(rawPage) || 1)));
  const { rows, total } = await listCustomers({ branchId: user.branchId ?? undefined, search: q, page, pageSize: 100 });

  const toolbar = (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <form action="/customers" method="GET" className="flex w-full items-center gap-2 sm:max-w-sm">
          <Input name="q" defaultValue={q ?? ""} placeholder="Cari nama / telepon / kode…" />
          <Button type="submit" size="icon" aria-label="Cari">
            <SearchIcon className="h-4 w-4" />
          </Button>
        </form>
        <div className="sm:ml-auto">
        </div>
        <p className="text-xs text-muted-foreground">{total} pelanggan · Ekspor tabel mencakup halaman ini</p>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Pelanggan"
        description="Data induk shohibul & lembaga — langsung dari basis data."
        actions={
          <CustomerFormDialog trigger={
            <Button variant="secondary">+ Pelanggan Baru</Button>
          } />
        }
      />

      <CustomerDataTable pagination={{ page, total, search: q }} rows={rows} toolbar={toolbar} exportExtra={<CustomerImportExtra />} />
    </div>
  );
}
