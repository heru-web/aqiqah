"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRolePermissionsAction } from "@/server/actions/system";
import { permissionGroups } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GROUPS = [...permissionGroups().entries()];

export function RolePermissionEditor({ roleId, initial }: { roleId: string; initial: string[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set(initial));
  const [pending, start] = useTransition();

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = () =>
    start(async () => {
      const res = await updateRolePermissionsAction(roleId, [...checked]);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Permission role diperbarui");
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {GROUPS.map(([group, perms]) => (
          <fieldset key={group} className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-primary">{group}</legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {perms.map((p) => (
                <label key={p.key} className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-input accent-primary"
                    checked={checked.has(p.key)}
                    onChange={() => toggle(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Permission"}
      </Button>
    </div>
  );
}