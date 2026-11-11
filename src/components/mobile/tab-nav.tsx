"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon, ChefHatIcon, Grid2x2Icon, TruckIcon } from "lucide-react";

const TABS = [
  { href: "/m", label: "Dasbor", icon: Grid2x2Icon },
  { href: "/m/pesanan", label: "Pesanan", icon: ClipboardListIcon },
  { href: "/m/rph", label: "RPH Syar'i", icon: ChefHatIcon },
  { href: "/m/kurir", label: "Kurir POD", icon: TruckIcon },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t, i) => {
          const active = pathname === t.href || (t.href !== "/m" && pathname.startsWith(t.href));
          const Icon = t.icon;
          const accent = i === 3 ? "bg-gold" : "bg-primary";
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-semibold ${
                  active ? "text-primary" : "text-slate-500"
                }`}
              >
                <span
                  className={`flex h-8 w-10 flex-col items-center justify-center rounded-xl ${
                    active ? `${accent} text-white` : ""
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
