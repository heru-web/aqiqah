import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/server/page-auth";
import { sendBroadcastFormAction } from "@/server/actions/broadcast";
import { MegaphoneIcon, SendIcon } from "lucide-react";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; failed?: string }>;
}) {
  const user = await requirePagePermission("notifications.notifications.view");
  const sp = await searchParams;
  const sent = sp.sent ? Number(sp.sent) : null;
  const failed = sp.failed ? Number(sp.failed) : null;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Broadcast WA"
        description="Kirim pesan WhatsApp ke daftar kontak pelanggan cabang. Token {nama} diganti otomatis per kontak. Kirim berkala (satu per satu) via gateway aktif."
        actions={null}
      />

      {(sent !== null || failed !== null) && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">Terkirim</p>
              <p className="mt-1 font-display text-2xl font-bold text-success">{sent ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">Gagal</p>
              <p className="mt-1 font-display text-2xl font-bold text-danger">{failed ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <form action={sendBroadcastFormAction} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pesan</label>
              <Textarea
                name="message"
                required
                rows={6}
                placeholder={"Assalamualaikum {nama},\nMadani Aqiqah berbagi informasi…"}
              />
              <p className="text-[11px] text-muted-foreground">Gunakan token <code className="font-data">{"{nama}"}</code> untuk menyapa per kontak. Pesan dikirim berurutan ke semua kontak aktif (duplikat nomor dilewati).</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Konfirmasi — ketik KIRIM</label>
              <input
                name="confirm"
                required
                pattern="KIRIM"
                placeholder="KIRIM"
                className="h-10 w-[160px] rounded-xl bg-surface/70 px-3 text-sm tracking-widest text-foreground ring-1 ring-line transition-colors placeholder:text-muted-foreground/60"
              />
              <p className="text-[11px] text-muted-foreground">Konfirmasi eksplisit terhadap biaya/mengganggu penerima. <Badge variant="warning">pesan nyata terkirim</Badge></p>
            </div>
            <Button type="submit">
              <SendIcon className="h-4 w-4" />
              Kirim Broadcast
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-dim px-3.5 py-3 text-xs text-muted-foreground ring-1 ring-line/10">
        <MegaphoneIcon className="h-4 w-4 shrink-0" />
        Operator: <span className="font-medium text-foreground">{user.name}</span>
        {user.branchId ? " · lingkup cabang sendiri" : " · semua cabang (superadmin)"}
      </div>
    </div>
  );
}
