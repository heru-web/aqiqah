import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CreateRoleDialog } from "@/components/system/dialogs";
import { RolePermissionEditor } from "@/components/system/role-permission-editor";
import { listRoles } from "@/server/services/users";
import { requirePagePermission } from "@/lib/server/page-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RolesPage() {
  await requirePagePermission("roles.roles.view");
  const roles = await listRoles();

  return (
    <div>
      <PageHeader title="Peran & Hak Akses" description="Kombinasi akses per peran tim." actions={<CreateRoleDialog />} />

      {roles.length === 0 ? (
        <EmptyState title="Belum ada role" description="Buat role pertama (contoh: superadmin, sales, ops, acct)." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {r.name}
                    {r.slug === "superadmin" && <Badge variant="gold">Superadmin · semua akses</Badge>}
                  </CardTitle>
                  {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.permissions.length} permission · wildcard {r.permissions.includes("*") ? "ya" : "tidak"}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <RolePermissionEditor roleId={r.id} initial={r.permissions} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}