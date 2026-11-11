"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction, type CrmFormState } from "@/server/actions/crm";

export function NoteForm({
  dealId,
  personId,
  organizationId,
  placeholder = "Tulis catatan internal…",
}: {
  dealId?: string;
  personId?: string;
  organizationId?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CrmFormState, FormData>(
    async (previous, formData) => {
      const result = await addNoteAction(previous, formData);
      if (result?.success) {
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    undefined
  );

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      {personId && <input type="hidden" name="personId" value={personId} />}
      {organizationId && <input type="hidden" name="organizationId" value={organizationId} />}
      <Textarea name="body" rows={3} placeholder={placeholder} required />
      {state?.error && <p className="text-xs text-danger-soft-foreground">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="compact" disabled={pending}>
          <SendIcon className="h-3.5 w-3.5" /> {pending ? "Menyimpan…" : "Kirim Catatan"}
        </Button>
      </div>
    </form>
  );
}
