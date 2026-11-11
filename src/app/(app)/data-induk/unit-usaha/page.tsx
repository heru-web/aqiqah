import { MasterDataTable } from "@/components/app/master-data-table";
import { listBusinessUnits } from "@/server/services/performance";
import { createBusinessUnitAction, updateBusinessUnitAction } from "@/server/actions/performance";
import { requirePagePermission } from "@/lib/server/page-auth";
import { deactivateBusinessUnitsAction } from "@/server/actions/master-rows";
import type { MasterField } from "@/components/performance/master-crud-dialog";

const createFields: MasterField[] = [
  { name: "code", label: "Kode", required: true, placeholder: "cth. AQIQAH" },
  { name: "name", label: "Nama", required: true, placeholder: "cth. Unit Aqiqah" },
  { name: "description", label: "Deskripsi", type: "textarea", placeholder: "Keterangan singkat unit usaha" },
];

const editFields: MasterField[] = [
  { name: "code", label: "Kode", readOnly: true },
  { name: "name", label: "Nama", required: true },
  { name: "description", label: "Deskripsi", type: "textarea" },
  { name: "isActive", label: "Aktif", type: "checkbox" },
];

export default async function BusinessUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}) {
  await requirePagePermission("performance.master.view");
  const { showAll } = await searchParams;
  const rows = await listBusinessUnits(showAll === "1");

  return (
    <MasterDataTable
      title="Unit Usaha"
      description="Master unit usaha dalam grup Madani Aqiqah."
      unit="unit"
      createTitle="Unit Usaha Baru"
      createLabel="+ Unit Usaha"
      rows={rows.map((u) => ({
        id: u.id,
        code: u.code,
        name: u.name,
        isActive: u.isActive,
        editValues: {
          id: u.id,
          code: u.code,
          name: u.name,
          description: u.description ?? "",
          isActive: String(u.isActive),
        },
      }))}
      createFields={createFields}
      editFields={editFields}
      createAction={createBusinessUnitAction}
      updateAction={updateBusinessUnitAction}
      bulkDeactivateAction={deactivateBusinessUnitsAction}
      exportFilename="data-induk-unit-usaha"
      togglePath="/data-induk/unit-usaha"
      showAll={showAll === "1"}
      emptyTitle="Belum ada unit usaha"
      emptyDescription="Tambahkan unit usaha pertama."
    />
  );
}
