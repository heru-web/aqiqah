"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardListIcon,
  HouseIcon,
  LayoutGridIcon,
  PhoneCallIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface BottomNavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  /** Buka sidebar daripada link. */
  menu?: boolean;
}

const ITEMS: BottomNavItem[] = [
  { href: "/dashboard", label: "Dasbor", icon: HouseIcon },
  { href: "/crm", label: "CRM", icon: PhoneCallIcon },
  { href: "/orders", label: "Pesanan", icon: ClipboardListIcon },
  { href: "/payments", label: "Bayar", icon: WalletIcon },
  { label: "Menu", icon: LayoutGridIcon, menu: true },
];

export function BottomNav({ allowed }: { allowed?: string[] | null } = {}) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const visibleItems = !allowed
    ? ITEMS
    : ITEMS.filter((item) => !item.href || allowed.includes(item.href) || item.href === "/dashboard");

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false;
        const content = (
          <>
            {active && <span className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-gradient-to-r from-brand-from to-brand-to" />}
            <span
              className={cn(
                "grid place-items-center rounded-lg px-2.5 py-1 transition-colors",
                active ? "bg-sidebar-accent" : "bg-transparent",
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-sidebar-foreground" : "text-sidebar-foreground/70")} />
            </span>
            <span className={cn("text-[10px] leading-tight", active ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/70")}>
              {item.label}
            </span>
          </>
        );

        if (item.menu) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={toggleSidebar}
              aria-label="Buka menu navigasi"
              className="relative flex flex-col items-center gap-0.5 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-from"
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-col items-center gap-0.5 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-from"
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
