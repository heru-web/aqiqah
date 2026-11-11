"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/server/actions/system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>({
    "company.name": typeof initial["company.name"] === "string" ? initial["company.name"] : "Madani Aqiqah",
    "company.tagline": typeof initial["company.tagline"] === "string" ? initial["company.tagline"] : "",
    "currency.code": typeof initial["currency.code"] === "string" ? initial["currency.code"] : "IDR",
    "delivery.defaultNote": typeof initial["delivery.defaultNote"] === "string" ? initial["delivery.defaultNote"] : "",
  });

  const field = "company.name" as const;

  const save = () =>
    start(async () => {
      const res = await saveSettingsAction({ ...values });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Pengaturan disimpan");
        router.refresh();
      }
    });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Identitas Usaha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={field}>Nama Usaha</Label>
            <Input id={field} value={values[field]} onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company.tagline">Tagline</Label>
            <Input
              id="company.tagline"
              value={values["company.tagline"]}
              onChange={(e) => setValues((v) => ({ ...v, "company.tagline": e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency.code">Kode Mata Uang</Label>
              <Input
                id="currency.code"
                value={values["currency.code"]}
                onChange={(e) => setValues((v) => ({ ...v, "currency.code": e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery.defaultNote">Catatan Pengiriman Default</Label>
            <Textarea
              id="delivery.defaultNote"
              rows={3}
              value={values["delivery.defaultNote"]}
              onChange={(e) => setValues((v) => ({ ...v, "delivery.defaultNote": e.target.value }))}
            />
          </div>
          <Button onClick={save} disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan Pengaturan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}