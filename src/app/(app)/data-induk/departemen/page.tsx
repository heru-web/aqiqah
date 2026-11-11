import { MasterDataTable } from "@/components/app/master-data-table";
import { listBusinessUnits, listDepartments } from "@/server/services/performance";
import { createDepartmentAction, updateDepartmentAction } from "@/server/actions/performance";
import { requirePagePermission } from "@/lib/server/page-auth";
import { deactivateDepartmentsAction } from "@/server/actions/master-rows";
import type { MasterField } from "@/components/performance/master-crud-dialog";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}) {
  await requirePagePermission("performance.master.view");
  const { showAll } = await searchParams;
  const [rows, units] = await Promise.all([
    listDepartments(showAll === "1"),
    listBusinessUnits(),
  ]);
  const unitOptions = units.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` }));

  const createFields: MasterField[] = [
    { name: "code", label: "Kode", required: true, placeholder: "cth. OPS" },
    { name: "name", label: "Nama", required: true, placeholder: "cth. Operasional" },
    { name: "businessUnitId", label: "Unit Usaha", type: "select", options: unitOptions },
  ];

  const editFields: MasterField[] = [
    { name: "code", label: "Kode", readOnly: true },
    { name: "name", label: "Nama", required: true },
    { name: "businessUnitId", label: "Unit Usaha", type: "select", options: unitOptions },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ];

  return (
    <MasterDataTable
      title="Departemen"
      description="Struktur departemen dan keterkaitannya dengan unit usaha."
      unit="departemen"
      createTitle="Departemen Baru"
      createLabel="+ Departemen"
      rows={rows.map(({ dept, buCode, buName }) => ({
        id: dept.id,
        code: dept.code,
        name: dept.name,
        isActive: dept.isActive,
        extra: buCode ? `${buCode} — ${buName}` : "—",
        extraLabel: "Unit Usaha",
        editValues: {
          id: dept.id,
          code: dept.code,
          name: dept.name,
          businessUnitId: dept.businessUnitId ?? "",
          isActive: String(dept.isActive),
        },
      }))}
      createFields={createFields}
      editFields={editFields}
      createAction={createDepartmentAction}
      updateAction={updateDepartmentAction}
      bulkDeactivateAction={deactivateDepartmentsAction}
      exportFilename="data-induk-departemen"
      togglePath="/data-induk/departemen"
      showAll={showAll === "1"}
      emptyTitle="Belum ada departemen"
      emptyDescription="Tambahkan departemen pertama."
    />
  );
}
