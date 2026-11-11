import { requirePagePermission } from "@/lib/server/page-auth";
import { listJournals } from "@/server/services/accounting";
import { JournalsTable } from "@/components/accounting/journals-table";

export default async function AccountingPage() {
  const user = await requirePagePermission("accounting.journals.view");
  const journals = await listJournals({ limit: 50, branchId: user.branchId });
  return (
    <JournalsTable
      journals={journals.map((j) => ({
        id: j.id,
        journalNumber: j.journalNumber,
        journalDate: j.journalDate.toISOString(),
        type: j.type,
        status: j.status,
        description: j.description,
        debitTotal: j.debitTotal.toString(),
        creditTotal: j.creditTotal.toString(),
      }))}
    />
  );
}
