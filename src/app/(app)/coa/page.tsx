import { requirePagePermission } from "@/lib/server/page-auth";
import { listAccounts } from "@/server/services/coa";
import { CoaTable } from "@/components/accounting/coa-table";

export default async function CoaPage() {
  await requirePagePermission("coa.coa.view");
  const accounts = await listAccounts();
  return (
    <CoaTable
      accounts={accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        group: a.group,
        description: a.description,
        parentId: a.parentId,
        isPostable: a.isPostable,
        isActive: a.isActive,
        isSystem: a.isSystem,
        openingBalance: a.openingBalance.toString(),
      }))}
    />
  );
}
