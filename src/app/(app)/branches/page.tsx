import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CreateBranchDialog } from "@/components/system/dialogs";
import { listBranches } from "@/server/services/settings";
import { requirePagePermission } from "@/lib/server/page-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function BranchesPage() {
  await requirePagePermission("branches.branches.view");
  const branches = await listBranches();

  return (
    <div>
      <PageHeader title="Cabang" description="Unit usaha madani — data & stok terpisah per cabang." actions={<CreateBranchDialog />} />

      {branches.length === 0 ? (
        <EmptyState title="Belum ada cabang" description="Cabang PUSAT dibuat saat seed database." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Pemilik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold text-primary">{b.code}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {b.name}
                      {b.code === "PUSAT" && <Badge variant="gold" className="ml-1.5">utama</Badge>}
                    </TableCell>
                    <TableCell>{b.city ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.phone ?? "—"}
                      {b.igHandle && <p className="text-xs">{b.igHandle}</p>}
                    </TableCell>
                    <TableCell>{b.ownerName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}