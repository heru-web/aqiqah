"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createMarketingSpendAction, type MasterFormState } from "@/server/actions/performance";

type MarketingChannelOption = {
  id: string;
  name: string;
  code: string;
  type: "ONLINE" | "OFFLINE";
  isActive: boolean;
  sortOrder: number;
};

export function MarketingSpendForm({ channels }: { channels: MarketingChannelOption[] }) {
  const [state, action, pending] = useActionState<MasterFormState, FormData>(createMarketingSpendAction, undefined);
  const activeChannels = channels.filter((channel) => channel.isActive);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="marketing-channel">Saluran Iklan</Label>
          <Select id="marketing-channel" name="channelId" defaultValue="">
            <option value="">— Pilih saluran —</option>
            {activeChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} ({channel.type === "ONLINE" ? "Online" : "Offline"})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="marketing-notes">Catatan</Label>
          <Input id="marketing-notes" name="notes" placeholder="cth. FB Ads Mei 2026" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="marketing-period-start">Periode Mulai</Label>
          <Input id="marketing-period-start" name="periodStart" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="marketing-period-end">Periode Akhir</Label>
          <Input id="marketing-period-end" name="periodEnd" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="marketing-amount">Nominal Spend (Rp)</Label>
          <Input id="marketing-amount" name="amount" inputMode="numeric" placeholder="15000000" required />
        </div>
      </div>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Spend"}
      </Button>
    </form>
  );
}
