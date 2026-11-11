"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRingIcon, ClockIcon, MegaphoneIcon, SaveIcon, SendIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveWaAlarmRuleAction, testWaAlarmAction } from "@/server/actions/wa-alerts";
import { TARGET_OPTIONS } from "./wa-alarms-types";
import type { WaAlertRuleView } from "./wa-alarms-types";

function RuleCard({ rule }: { rule: WaAlertRuleView }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [target, setTarget] = useState(rule.targetRoles ?? "SUPERADM");

  const save = (fd: FormData) =>
    startSaving(async () => {
      const res = await saveWaAlarmRuleAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res?.message ?? "Tersimpan");
      router.refresh();
    });

  const test = () =>
    startTesting(async () => {
      const res = await testWaAlarmAction(rule.id, rule.code);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res?.message ?? "Selesai");
      router.refresh();
    });

  return (
    <Card className="border-line-warm">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
          <span className="flex items-center gap-2">
            <BellRingIcon className={`h-4 w-4 ${rule.enabled ? "text-warning" : "text-muted-foreground"}`} />
            {rule.label}
          </span>
          <Badge variant={rule.enabled ? "warning" : "neutral"}>{rule.enabled ? "aktif" : "mati"}</Badge>
        </CardTitle>
        <CardDescription>{rule.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            fd.set("id", rule.id);
            save(fd);
          }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor={`h-${rule.id}`} className="text-xs">
              Jam (WIB)
            </Label>
            <Input id={`h-${rule.id}`} name="hour" type="number" min={0} max={23} defaultValue={rule.sendHour} className="w-20" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`m-${rule.id}`} className="text-xs">
              Menit
            </Label>
            <Input id={`m-${rule.id}`} name="minute" type="number" min={0} max={59} defaultValue={rule.sendMinute} className="w-20" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`t-${rule.id}`} className="text-xs">
              Kirim ke
            </Label>
            <Select id={`t-${rule.id}`} name="targetRoles" value={target} onChange={(e) => setTarget(e.target.value)}>
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />
          <input type="hidden" name="onlyWeekdays" value={rule.onlyWeekdays ? "true" : "false"} />
          <input type="hidden" name="template" value={rule.template ?? ""} />
          <div className="sm:col-span-4 flex flex-wrap items-center gap-2.5 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Switch checked={enabled} onCheckedChange={(v) => setEnabled(v)} aria-label={`aktifkan ${rule.label}`} />
              {enabled ? "AKTIF" : "MATI"}
            </span>
            <Button type="submit" size="compact" variant="secondary" disabled={saving}>
              <SaveIcon className="h-3.5 w-3.5" />
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button type="button" size="compact" variant="outline" disabled={testing} onClick={test}>
              <MegaphoneIcon className="h-3.5 w-3.5" />
              {testing ? "Menguji…" : "Kirim Tes ke Saya"}
            </Button>
          </div>
        </form>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <ClockIcon className="h-3 w-3" />
          {rule.lastSentAt
            ? `Terakhir kirim: ${new Date(rule.lastSentAt).toLocaleString("id-ID")}`
            : "Belum pernah terkirim"}
        </p>
      </CardContent>
    </Card>
  );
}

export function AlarmModule({
  rules,
  logs,
}: {
  rules: WaAlertRuleView[];
  logs: Array<{ ruleCode: string; recipients: string; message: string; status: string; error: string | null; createdAt: string }>;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <SendIcon className="h-4 w-4 text-primary" />
            Aturan Alarm
          </CardTitle>
          <CardDescription>
            Tidak perlu WA — alarm dikirim sebagai <b>notifikasi panel</b> (lonceng di header) untuk superadmin &amp; peran terkait.
            Jam memakai <b>WIB</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <BellRingIcon className="h-4 w-4 text-warning" />
            Log Pengiriman Terakhir
          </CardTitle>
          <CardDescription>Jejak seluruh alarm yang sudah dieksekusi panel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada log — alarm belum pernah jalan.</p>}
          {logs.map((log, i) => (
            <div key={i} className="rounded-xl border border-line-warm px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-data text-[11px] uppercase text-muted-foreground">{log.ruleCode}</p>
                <Badge variant={log.status === "SENT" ? "success" : log.status === "PARTIAL" ? "warning" : "danger"}>
                  {log.status}
                </Badge>
              </div>
              <p className="text-sm text-foreground/90" style={{ whiteSpace: "pre-line" }}>
                {log.message}
              </p>
              <p className="font-data text-[10.5px] text-muted-foreground">
                {new Date(log.createdAt).toLocaleString("id-ID")} · {log.recipients}
                {log.error ? ` · rintangan: ${log.error}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
