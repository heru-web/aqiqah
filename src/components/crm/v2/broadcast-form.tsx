"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendWhatsappBroadcastAction } from "@/server/actions/whatsapp";
import type { CrmPersonRow } from "@/server/services/crm";

export function BroadcastForm({ people }: { people: CrmPersonRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; sent?: number; failed?: number; error?: string } | null>(null);

  const candidates = people.filter((person) => Boolean(person.whatsapp || person.phone));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const recipients = selected
      .map((id) => {
        const person = people.find((item) => item.id === id);
        if (!person) return null;
        return { phone: person.whatsapp ?? person.phone ?? "", personId: person.id };
      })
      .filter((item): item is { phone: string; personId: string } => item !== null);
    const res = await sendWhatsappBroadcastAction({ recipients, message });
    setResult(res);
    setPending(false);
    if (res.ok) {
      setSelected([]);
      setMessage("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Pilih penerima ({selected.length} dari {candidates.length})</p>
        <div className="max-h-64 overflow-y-auto rounded-md border p-2">
          {candidates.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada kontak dengan nomor WhatsApp.</p>
          ) : (
            candidates.map((person) => (
              <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selected.includes(person.id)}
                  onChange={() => toggle(person.id)}
                />
                <span className="font-medium">{person.name}</span>
                <span className="text-muted-foreground">{person.whatsapp ?? person.phone}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="broadcast-message" className="text-sm font-medium">
          Pesan WA
        </label>
        <Textarea
          id="broadcast-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          placeholder="Halo {nama}, ..."
          required
        />
      </div>

      {result && (
        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          {result.error ? (
            <p className="text-danger-soft-foreground">{result.error}</p>
          ) : (
            <p>
              Broadcast selesai: {result.sent ?? 0} terkirim, {result.failed ?? 0} gagal.
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending || selected.length === 0 || !message.trim()}>
        {pending ? "Mengirim…" : "Kirim Broadcast"}
      </Button>
    </form>
  );
}
