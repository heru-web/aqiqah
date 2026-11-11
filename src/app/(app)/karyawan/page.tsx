import { requirePagePermission } from "@/lib/server/page-auth";
import { listEmployees } from "@/server/services/hr";
import { listDepartments, listPositions } from "@/server/services/performance";
import { EmployeeTable } from "@/components/hr/employee-table";

export default async function KaryawanPage({
  searchParams,
}: {
  searchParams: Promise<{ cari?: string }>;
}) {
  const user = await requirePagePermission("employees.employees.view");
  const { cari } = await searchParams;

  const [employees, depts, positions] = await Promise.all([
    listEmployees({ search: cari, branchId: user.branchId }),
    listDepartments(),
    listPositions(),
  ]);

  return (
    <EmployeeTable
      initialSearch={cari ?? ""}
      employees={employees.map((e) => ({
        id: e.id,
        employeeNumber: e.employeeNumber,
        name: e.name,
        positionId: e.positionId,
        positionName: e.positionName,
        departmentId: e.departmentId,
        departmentName: e.departmentName,
        joinedAt: e.joinedAt,
        status: e.status,
        phone: e.phone,
        basicSalary: e.basicSalary,
      }))}
      departments={depts.map((d) => ({ id: d.dept.id, name: d.dept.name }))}
      positions={positions.map((p) => ({ id: p.pos.id, name: p.pos.name }))}
    />
  );
}
