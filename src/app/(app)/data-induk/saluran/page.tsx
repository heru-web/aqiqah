import { MasterDataTable } from "@/components/app/master-data-table";
import { listSalesChannels } from "@/server/services/performance";
import { createSalesChannelAction, updateSalesChannelAction } from "@/server/actions/performance";
import { requirePagePermission } from "@/lib/server/page-auth";
import { deactivateSalesChannelsAction } from "@/server/actions/master-rows";
import type { MasterField } from "@/components/performance/master-crud-dialog";

const typeOptions = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
];

const createFields: MasterField[] = [
  { name: "code", label: "Kode", required: true, placeholder: "cth. WA" },
  { name: "name", label: "Nama Saluran", required: true, placeholder: "cth. WhatsApp" },
  { name: "type", label: "Tipe", type: "select", required: true, options: typeOptions },
];

const editFields: MasterField[] = [
  { name: "code", label: "Kode", readOnly: true },
  { name: "name", label: "Nama Saluran", required: true },
  { name: "type", label: "Tipe", type: "select", required: true, options: typeOptions },
  { name: "isActive", label: "Aktif", type: "checkbox" },
];

export default async function SalesChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}) {
  await requirePagePermission("performance.master.view");
  const { showAll } = await searchParams;
  const rows = await listSalesChannels(showAll === "1");

  return (
    <MasterDataTable
      title="Saluran Penjualan"
      description="Kanal online & offline untuk analisis KPI pemasaran."
      unit="saluran"
      createTitle="Saluran Baru"
      createLabel="+ Saluran"
      rows={rows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        isActive: c.isActive,
        type: c.type === "ONLINE" ? "Online" : "Offline",
        typeLabel: "Tipe",
        typeVariant: c.type === "ONLINE" ? "info" : "gold",
        editValues: {
          id: c.id,
          code: c.code,
          name: c.name,
          type: c.type,
          isActive: String(c.isActive),
        },
      }))}
      createFields={createFields}
      editFields={editFields}
      createAction={createSalesChannelAction}
      updateAction={updateSalesChannelAction}
      bulkDeactivateAction={deactivateSalesChannelsAction}
      exportFilename="data-induk-saluran"
      togglePath="/data-induk/saluran"
      showAll={showAll === "1"}
      emptyTitle="Belum ada saluran"
      emptyDescription="Tambahkan saluran penjualan pertama."
    />
  );
}
