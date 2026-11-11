"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleIcon, QrCodeIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { WaKeysManager, type WaKeyRow } from "@/components/system/wa-keys-manager";
import { WHATSAPP_PROVIDERS, WHATSAPP_SETTING_KEYS, type WhatsappGatewayStatus, type WhatsappSettings } from "@/lib/whatsapp";
import {
  saveWhatsappSettingsAction,
  testWhatsappConnectionAction,
} from "@/server/actions/whatsapp";
import { toast } from "sonner";

const KEYS = WHATSAPP_SETTING_KEYS;
const VARIABLES = ["{nama}", "{perusahaan}", "{produk}", "{nilai}", "{tahap}", "{judul}", "{kota}", "{tanggal}"];
const TABS = ["koneksi", "pesan", "otomatisasi", "api-keys", "panduan"] as const;
type TabValue = (typeof TABS)[number];

function toFormValues(initial: WhatsappSettings): Record<string, string> {
  return {
    [KEYS.provider]: initial.provider,
    [KEYS.enabled]: initial.enabled ? "true" : "false",
    [KEYS.fonnteToken]: initial.fonnteToken,
    [KEYS.cloudToken]: initial.cloudToken,
    [KEYS.cloudPhoneId]: initial.cloudPhoneId,
    [KEYS.cloudTemplate]: initial.cloudTemplate,
    [KEYS.gatewayUrl]: initial.gatewayUrl,
    [KEYS.apiToken]: initial.apiToken,
    [KEYS.deviceLabel]: initial.deviceLabel,
    [KEYS.countryCode]: initial.countryCode,
    [KEYS.signature]: initial.signature,
    [KEYS.autoEnabled]: initial.autoEnabled ? "true" : "false",
    [KEYS.autoOnCreate]: initial.autoOnCreate ? "true" : "false",
    [KEYS.autoOnStageChange]: initial.autoOnStageChange ? "true" : "false",
    [KEYS.autoStageId]: initial.autoStageId,
    [KEYS.templateNewDeal]: initial.templateNewDeal,
    [KEYS.templateStageChange]: initial.templateStageChange,
    [KEYS.templateManual]: initial.templateManual,
  };
}

export function WhatsappSettingsForm({
  initial,
  initialStatus,
  stages,
  waKeys,
  initialTab,
}: {
  initial: WhatsappSettings;
  initialStatus: WhatsappGatewayStatus;
  stages: Array<{ id: string; name: string }>;
  waKeys: WaKeyRow[];
  initialTab?: string;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [values, setValues] = useState<Record<string, string>>(() => toFormValues(initial));
  const [tab, setTab] = useState<TabValue>(
    TABS.includes((initialTab ?? "") as TabValue) ? (initialTab as TabValue) : "koneksi"
  );

  const provider = (values[KEYS.provider] as "WAHA" | "FONNTE" | "CLOUD") ?? "WAHA";
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const isOn = (key: string) => values[key] === "true";

  const changeTab = (value: string) => {
    const next = (TABS.includes(value as TabValue) ? value : "koneksi") as TabValue;
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/settings/whatsapp?tab=${next}`);
    }
  };

  const save = () =>
    startSaving(async () => {
      const result = await saveWhatsappSettingsAction(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pengaturan WhatsApp disimpan");
      router.refresh();
    });

  const test = () =>
    startTesting(async () => {
      const result = await testWhatsappConnectionAction();
      if (result.error || !result.status) {
        toast.error(result.error ?? "Gagal memeriksa gateway.");
        return;
      }
      setStatus(result.status);
      if (result.status.ready) toast.success("Gateway WhatsApp terhubung.");
      else toast.warning("Tersambung ke provider, tetapi belum siap kirim. Periksa konfigurasi.");
    });

  const ready = status.ready;
  const reachable = provider === "WAHA" ? status.reachable : true;
  const qrAvailable = provider === "WAHA" && status.reachable;
  const statusVariant = ready ? "success" : reachable ? "warning" : "danger";
  const statusLabel = ready ? (provider === "CLOUD" ? "Siap (Cloud API)" : provider === "FONNTE" ? "Siap (Fonnte)" : "Terhubung") : reachable ? "Belum siap" : "Tidak terjangkau";

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="koneksi" className="shrink-0">Koneksi</TabsTrigger>
          <TabsTrigger value="pesan" className="shrink-0">Pesan & Template</TabsTrigger>
          <TabsTrigger value="otomatisasi" className="shrink-0">Otomatisasi</TabsTrigger>
          <TabsTrigger value="api-keys" className="shrink-0">API Keys</TabsTrigger>
          <TabsTrigger value="panduan" className="shrink-0">Panduan</TabsTrigger>
        </TabsList>

        <TabsContent value="koneksi" className="space-y-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircleIcon className="h-4 w-4 text-primary" />
                  Koneksi WhatsApp
                </CardTitle>
                <CardDescription>
                  Pilih sumber pengiriman: gateway WAHA lokal (scan QR), Fonnte (API key), atau WhatsApp Cloud API resmi Meta.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
                <Button type="button" variant="outline" size="compact" onClick={test} disabled={testing}>
                  <RefreshCwIcon className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                  {testing ? "Memeriksa…" : "Tes Koneksi"}
                </Button>
                {qrAvailable ? (
                  <Button asChild variant="outline" size="compact">
                    <a href="/api/whatsapp/qr" target="_blank" rel="noopener noreferrer">
                      <QrCodeIcon className="h-3.5 w-3.5" /> Buka QR
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-line/10 bg-surface px-3 py-2 text-[11.5px] text-muted-foreground">
                {status.error ? (
                  <span className="text-danger-soft-foreground">{status.error}</span>
                ) : (
                  <span>
                    Status gateway: <span className="font-semibold text-foreground">{status.status}</span>
                    {status.me?.id ? ` · ${status.me.id}` : ""}
                    {status.engine ? ` · ${status.engine}` : ""}
                  </span>
                )}
              </div>

              <SwitchRow
                id="wa-enabled"
                label="Aktifkan integrasi WhatsApp"
                description="Izinkan CRM mengirim pesan melalui gateway ini."
                checked={isOn(KEYS.enabled)}
                onCheckedChange={(checked) => set(KEYS.enabled, checked ? "true" : "false")}
              />

              <div className="space-y-1.5">
                <Label htmlFor="wa-provider">Sumber Pengiriman (Provider)</Label>
                <Select id="wa-provider" value={values[KEYS.provider]} onChange={(e) => set(KEYS.provider, e.target.value)}>
                  {WHATSAPP_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </Select>
                <p className="text-[10.5px] text-muted-foreground">
                  {WHATSAPP_PROVIDERS.find((p) => p.value === provider)?.hint ?? ""}
                </p>
              </div>

              {provider === "WAHA" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wa-url">URL Gateway</Label>
                    <Input
                      id="wa-url"
                      value={values[KEYS.gatewayUrl]}
                      onChange={(event) => set(KEYS.gatewayUrl, event.target.value)}
                      placeholder="http://127.0.0.1:3015"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wa-token">Token Gateway</Label>
                    <Input
                      id="wa-token"
                      type="password"
                      value={values[KEYS.apiToken]}
                      onChange={(event) => set(KEYS.apiToken, event.target.value)}
                      placeholder="Bearer token gateway"
                      autoComplete="new-password"
                    />
                    <p className="text-[10.5px] text-muted-foreground">
                      Disimpan di pengaturan aplikasi. Jangan bagikan token ini.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-device">Nama Perangkat</Label>
                    <Input
                      id="wa-device"
                      value={values[KEYS.deviceLabel]}
                      onChange={(event) => set(KEYS.deviceLabel, event.target.value)}
                      placeholder="CRM Madani Aqiqah"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-country">Kode Negara</Label>
                    <Input
                      id="wa-country"
                      value={values[KEYS.countryCode]}
                      onChange={(event) => set(KEYS.countryCode, event.target.value)}
                      placeholder="62"
                      inputMode="numeric"
                    />
                    <p className="text-[10.5px] text-muted-foreground">
                      Nomor 08xx otomatis dinormalisasi menjadi 62xx.
                    </p>
                  </div>
                </div>
              )}

              {provider === "FONNTE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="wa-fonnte">API Key Fonnte</Label>
                  <Input
                    id="wa-fonnte"
                    type="password"
                    value={values[KEYS.fonnteToken]}
                    onChange={(event) => set(KEYS.fonnteToken, event.target.value)}
                    placeholder="Tempel API key dari panel Fonnte"
                    autoComplete="new-password"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    Dikirim via api.fonnte.com dengan token perangkat Fonnte Anda.
                  </p>
                </div>
              )}

              {provider === "CLOUD" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wa-cloud-token">Access Token (Cloud API)</Label>
                    <Input
                      id="wa-cloud-token"
                      type="password"
                      value={values[KEYS.cloudToken]}
                      onChange={(event) => set(KEYS.cloudToken, event.target.value)}
                      placeholder="Permanent token dari Meta Business"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-cloud-phone">Phone Number ID</Label>
                    <Input
                      id="wa-cloud-phone"
                      value={values[KEYS.cloudPhoneId]}
                      onChange={(event) => set(KEYS.cloudPhoneId, event.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="ID nomor WhatsApp Business"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-cloud-tmpl">Nama Template (opsional)</Label>
                    <Input
                      id="wa-cloud-tmpl"
                      value={values[KEYS.cloudTemplate]}
                      onChange={(event) => set(KEYS.cloudTemplate, event.target.value)}
                      placeholder="ctd. template_sapa_1"
                    />
                    <p className="text-[10.5px] text-muted-foreground">
                      Untuk pesan pertama dari bisnis ke calon, isi nama template yang sudah disetujui Meta.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pesan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pesan & Template</CardTitle>
              <CardDescription>
                Tanda tangan dan template pesan yang dipakai untuk pesan manual maupun otomatis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wa-signature">Tanda Tangan Pesan</Label>
                <Textarea
                  id="wa-signature"
                  rows={2}
                  value={values[KEYS.signature]}
                  onChange={(event) => set(KEYS.signature, event.target.value)}
                  placeholder="— Tim Madani Aqiqah"
                />
                <p className="text-[10.5px] text-muted-foreground">
                  Ditambahkan otomatis di akhir setiap pesan. Kosongkan bila tidak diperlukan.
                </p>
              </div>

              <TemplateField
                id="wa-template-new"
                label="Template deal baru"
                value={values[KEYS.templateNewDeal]}
                onChange={(value) => set(KEYS.templateNewDeal, value)}
              />
              <TemplateField
                id="wa-template-stage"
                label="Template perubahan tahap"
                value={values[KEYS.templateStageChange]}
                onChange={(value) => set(KEYS.templateStageChange, value)}
              />
              <TemplateField
                id="wa-template-manual"
                label="Template pesan manual"
                value={values[KEYS.templateManual]}
                onChange={(value) => set(KEYS.templateManual, value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variabel Pesan</CardTitle>
              <CardDescription>Gunakan variabel ini di dalam template.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {VARIABLES.map((variable) => (
                <code key={variable} className="rounded-md bg-muted px-1.5 py-1 text-[11px] font-semibold text-foreground/80">
                  {variable}
                </code>
              ))}
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Variabel yang tidak tersedia akan diganti menjadi teks kosong. Tanda tangan pesan ditambahkan
                otomatis di akhir.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="otomatisasi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pesan Otomatis</CardTitle>
              <CardDescription>
                Kirim WhatsApp otomatis dari CRM saat deal baru dibuat atau tahap pipeline berubah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SwitchRow
                id="wa-auto"
                label="Aktifkan pesan otomatis"
                description="Hanya dikirim bila kontak memiliki nomor WhatsApp/telepon."
                checked={isOn(KEYS.autoEnabled)}
                onCheckedChange={(checked) => set(KEYS.autoEnabled, checked ? "true" : "false")}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SwitchRow
                  id="wa-auto-create"
                  label="Saat deal baru dibuat"
                  description="Gunakan template sapaan deal baru."
                  checked={isOn(KEYS.autoOnCreate)}
                  onCheckedChange={(checked) => set(KEYS.autoOnCreate, checked ? "true" : "false")}
                  disabled={!isOn(KEYS.autoEnabled)}
                />
                <SwitchRow
                  id="wa-auto-stage"
                  label="Saat tahap berubah"
                  description="Kirim update ketika deal berpindah tahap."
                  checked={isOn(KEYS.autoOnStageChange)}
                  onCheckedChange={(checked) => set(KEYS.autoOnStageChange, checked ? "true" : "false")}
                  disabled={!isOn(KEYS.autoEnabled)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-auto-stage-id">Batasi ke tahap tertentu (opsional)</Label>
                <Select
                  id="wa-auto-stage-id"
                  value={values[KEYS.autoStageId]}
                  onChange={(event) => set(KEYS.autoStageId, event.target.value)}
                  disabled={!isOn(KEYS.autoEnabled) || !isOn(KEYS.autoOnStageChange)}
                >
                  <option value="">Semua tahap</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <WaKeysManager keys={waKeys} />
        </TabsContent>

        <TabsContent value="panduan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Panduan Singkat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
              <p>1. Pastikan URL dan token sama dengan konfigurasi container WA Gateway.</p>
              <p>2. Klik <strong>Buka QR</strong>, lalu pindai dengan WhatsApp di ponsel.</p>
              <p>3. Setelah status menjadi <strong>Terhubung</strong>, pesan manual dan otomatis siap dipakai.</p>
              <p>4. Riwayat pesan terkirim muncul sebagai aktivitas WhatsApp pada deal/kontak CRM.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          <SaveIcon className="h-4 w-4" />
          {saving ? "Menyimpan…" : "Simpan Pengaturan WhatsApp"}
        </Button>
      </div>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-line/10 bg-surface/60 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function TemplateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
