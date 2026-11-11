"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { NAV_GROUPS } from "@/components/app/nav";
import { moduleGroupColor } from "@/lib/module-colors";

interface ResolvedModule {
  Icon: LucideIcon;
  color: string;
  label?: string;
}

export function resolveModule(pathname: string): ResolvedModule | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    if (item) return { Icon: item.icon, color: moduleGroupColor(group.group), label: group.group };
  }
  return null;
}

/** Chip ikon berwarna per modul — identitas visual tiap halaman. */
export function ModuleChip() {
  const pathname = usePathname();
  const mod = resolveModule(pathname);
  if (!mod || pathname.startsWith("/m")) return null;
  return (
    <div
      className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ring-1 ring-white/20"
      style={{ backgroundColor: mod.color }}
      title={mod.label}
    >
      <mod.Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}
