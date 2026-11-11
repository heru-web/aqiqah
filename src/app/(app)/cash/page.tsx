import { requirePagePermission } from "@/lib/server/page-auth";
import { listCashAccounts } from "@/server/services/cash";
import { CashTable } from "@/components/accounting/cash-table";

export default async function CashPage() {
  const user = await requirePagePermission("cash.cash.view");
  const accounts = await listCashAccounts(user);
  return (
    <CashTable
      accounts={accounts.map((a) => ({
        id: a.id,
        branchId: a.branchId,
        name: a.name,
        type: a.type,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        openingBalance: a.openingBalance.toString(),
        isActive: a.isActive,
      }))}
    />
  );
}
