"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type MasterFormState = { error?: string; success?: boolean } | undefined;

export interface MasterField {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "checkbox" | "date" | "month" | "email";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
  readOnly?: boolean;
}

interface Props {
  title: string;
  description?: string;
  fields: MasterField[];
  action: (prev: MasterFormState, fd: FormData) => Promise<MasterFormState>;
  trigger?: React.ReactNode;
  editValues?: Record<string, string>;
}

export function MasterCrudDialog({ title, description, fields, action, trigger, editValues }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<MasterFormState, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd);
      if (res?.success) {
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    undefined
  );
  const isEdit = Boolean(editValues?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusIcon className="h-4 w-4" />
            Tambah
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={editValues!.id} />}
          {fields.map((field) => {
            const val = editValues?.[field.name] ?? field.defaultValue ?? "";
            if (field.type === "checkbox") {
              return (
                <div key={field.name} className="flex items-center gap-2">
                  <input
                    id={`f-${field.name}`}
                    type="checkbox"
                    name={field.name}
                    value="true"
                    defaultChecked={editValues ? val !== "false" : field.defaultValue === "true"}
                    className="size-4"
                  />
                  <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
                </div>
              );
            }
            if (field.type === "select") {
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={`f-${field.name}`}>
                    {field.label}
                    {field.required && " *"}
                  </Label>
                  <Select
                    id={`f-${field.name}`}
                    name={field.name}
                    defaultValue={val}
                    required={field.required}
                  >
                    <option value="">— pilih —</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            }
            if (field.type === "textarea") {
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={`f-${field.name}`}>
                    {field.label}
                    {field.required && " *"}
                  </Label>
                  <Textarea
                    id={`f-${field.name}`}
                    name={field.name}
                    defaultValue={val}
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={3}
                  />
                </div>
              );
            }
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`f-${field.name}`}>
                  {field.label}
                  {field.required && " *"}
                </Label>
                <Input
                  id={`f-${field.name}`}
                  type={field.type ?? "text"}
                  name={field.name}
                  defaultValue={val}
                  required={field.required}
                  placeholder={field.placeholder}
                  readOnly={field.readOnly}
                />
              </div>
            );
          })}
          {state?.error && (
            <p className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger-soft-foreground ring-1 ring-danger/25">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
