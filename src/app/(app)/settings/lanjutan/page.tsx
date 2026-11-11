import { PageHeader } from "@/components/app/page-header";
import { DemoDataButtons } from "@/components/system/demo-data-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/server/page-auth";

export const dynamic = "force-dynamic";

export default async function SettingsAdvancedPage() {
  await requirePagePermission("settings.settings.update");

  return (
    <div>
      <PageHeader
        title="Data Demo & Reset"
        description="Zona lanjutan yang memengaruhi banyak modul sekaligus. Gunakan dengan hati-hati."
        actions={null}
      />
      <Card className="border-danger/30 bg-danger-soft/10">
        <CardHeader>
          <CardTitle className="text-danger-soft-foreground">Zona Berbahaya</CardTitle>
          <CardDescription>
            Isi atau hapus data contoh di seluruh modul (karyawan, inventaris, produksi, pengiriman,
            penggajian, kasbon, ziswaf, penawaran, pesanan, tagihan, pembayaran, jurnal, CRM, absensi).
            Data demo diberi tanda <span className="rounded-md bg-gold/15 px-1.5 py-0.5 font-mono text-[11px] text-gold-foreground">Data demo</span>{" "}
            agar mudah dikenali.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Menghapus data demo akan menghapus <strong>semua</strong> data bertanda demo dan tidak bisa
            dibatalkan. Data asli yang Anda input sendiri tidak tersentuh.
          </p>
          <DemoDataButtons />
        </CardContent>
      </Card>
    </div>
  );
}
