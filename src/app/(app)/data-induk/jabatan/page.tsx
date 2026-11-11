import { MasterDataTable } from "@/components/app/master-data-table";
import { listDepartments, listPositions } from "@/server/services/performance";
import { createPositionAction, updatePositionAction } from "@/server/actions/performance";
import { requirePagePermission } from "@/lib/server/page-auth";
import { deactivatePositionsAction } from "@/server/actions/master-rows";
import type { MasterField } from "@/components/performance/master-crud-dialog";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}) {
  await requirePagePermission("performance.master.view");
  const { showAll } = await searchParams;
  const [rows, depts] = await Promise.all([listPositions(showAll === "1"), listDepartments()]);
  const deptOptions = depts.map((d) => ({ value: d.dept.id, label: `${d.dept.code} — ${d.dept.name}` }));

  const createFields: MasterField[] = [
    { name: "code", label: "Kode", required: true, placeholder: "cth. KURIR" },
    { name: "name", label: "Nama Jabatan", required: true, placeholder: "cth. Kurir" },
    { name: "departmentId", label: "Departemen", type: "select", required: true, options: deptOptions },
  ];

  const editFields: MasterField[] = [
    { name: "code", label: "Kode", readOnly: true },
    { name: "name", label: "Nama Jabatan", required: true },
    { name: "departmentId", label: "Departemen", type: "select", required: true, options: deptOptions },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ];

  return (
    <MasterDataTable
      title="Jabatan"
      description="Daftar jabatan per departemen untuk penilaian kinerja."
      unit="jabatan"
      createTitle="Jabatan Baru"
      createLabel="+ Jabatan"
      rows={rows.map(({ pos, deptCode, deptName }) => ({
        id: pos.id,
        code: pos.code,
        name: pos.name,
        isActive: pos.isActive,
        extra: `${deptCode} — ${deptName}`,
        extraLabel: "Departemen",
        editValues: {
          id: pos.id,
          code: pos.code,
          name: pos.name,
          departmentId: pos.departmentId,
          isActive: String(pos.isActive),
        },
      }))}
      createFields={createFields}
      editFields={editFields}
      createAction={createPositionAction}
      updateAction={updatePositionAction}
      bulkDeactivateAction={deactivatePositionsAction}
      exportFilename="data-induk-jabatan"
      togglePath="/data-induk/jabatan"
      showAll={showAll === "1"}
      emptyTitle="Belum ada jabatan"
      emptyDescription="Tambahkan jabatan pertama."
    />
  );
}
