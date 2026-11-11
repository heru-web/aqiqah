"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/crm";
import { createActivityAction, type CrmFormState } from "@/server/actions/crm";
import type { UserOption } from "./types";

export function ActivityDialog({
  dealId,
  personId,
  organizationId,
  users,
  defaultOwnerId,
  trigger,
}: {
  dealId?: string;
  personId?: string;
  organizationId?: string;
  users: UserOption[];
  defaultOwnerId?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CrmFormState, FormData>(
    async (previous, formData) => {
      const result = await createActivityAction(previous, formData);
      if (result?.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aktivitas Baru</DialogTitle>
          <DialogDescription>Catat follow-up, tugas, atau jadwal pertemuan.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          {personId && <input type="hidden" name="personId" value={personId} />}
          {organizationId && <input type="hidden" name="organizationId" value={organizationId} />}

          <div className="space-y-1.5">
            <Label htmlFor="activity-title">Judul *</Label>
            <Input
              id="activity-title"
              name="title"
              required
              minLength={2}
              placeholder="Follow-up penawaran paket Gold"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="activity-type">Jenis</Label>
              <Select id="activity-type" name="type" defaultValue="WHATSAPP">
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-due">Jadwal</Label>
              <Input id="activity-due" name="dueAt" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-owner">Penanggung jawab</Label>
            <Select id="activity-owner" name="ownerId" defaultValue={defaultOwnerId ?? ""}>
              <option value="">Belum ditugaskan</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-notes">Catatan</Label>
            <Textarea id="activity-notes" name="notes" rows={3} placeholder="Hasil pembicaraan / instruksi…" />
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <CalendarPlusIcon className="h-4 w-4" />
              {pending ? "Menyimpan…" : "Simpan Aktivitas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
