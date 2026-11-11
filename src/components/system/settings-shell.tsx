"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRingIcon,
  BoxesIcon,
  BuildingIcon,
  CircleUserIcon,
  IdCardIcon,
  MessageCircleIcon,
  NetworkIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  StoreIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  href: string;
  label: string;
  icon: typeof Settings2Icon;
  perm: string;
  danger?: boolean;
}

interface SettingsNavGroup {
  group: string;
  items: SettingsNavItem[];
}

const GROUPS: SettingsNavGroup[] = [
  {
    group: "Umum",
    items: [{ href: "/settings", label: "Identitas Usaha", icon: Settings2Icon, perm: "settings.settings.view" }],
  },
  {
    group: "Komunikasi",
    items: [
      { href: "/settings/whatsapp", label: "WA Gateway", icon: MessageCircleIcon, perm: "settings.settings.view" },
      { href: "/settings/alarm", label: "Alarm Notifikasi", icon: BellRingIcon, perm: "settings.settings.view" },
    ],
  },
  {
    group: "Master Data",
    items: [
      { href: "/data-induk/unit-usaha", label: "Unit Usaha", icon: BuildingIcon, perm: "performance.master.view" },
      { href: "/data-induk/departemen", label: "Departemen", icon: NetworkIcon, perm: "performance.master.view" },
      { href: "/data-induk/jabatan", label: "Jabatan", icon: IdCardIcon, perm: "performance.master.view" },
      { href: "/data-induk/saluran", label: "Saluran Penjualan", icon: StoreIcon, perm: "performance.master.view" },
    ],
  },
  {
    group: "Akses & Keamanan",
    items: [
      { href: "/users", label: "Pengguna", icon: CircleUserIcon, perm: "users.users.view" },
      { href: "/roles", label: "Peran & Hak Akses", icon: ShieldCheckIcon, perm: "roles.roles.view" },
      { href: "/branches", label: "Cabang", icon: BoxesIcon, perm: "branches.branches.view" },
      { href: "/audit", label: "Log Audit", icon: ScrollTextIcon, perm: "audit.audit.view" },
    ],
  },
  {
    group: "Lanjutan",
    items: [
      { href: "/settings/lanjutan", label: "Data Demo & Reset", icon: TriangleAlertIcon, perm: "settings.settings.update", danger: true },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsShell({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(permissions, i.perm)) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <nav className="mb-4 lg:sticky lg:top-4 lg:mb-0" aria-label="Navigasi pengaturan">
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
          {groups.map((group) => (
            <div key={group.group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-1">
              <p className="hidden px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">
                {group.group}
              </p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors lg:w-full",
                      active
                        ? "bg-surface text-primary shadow-card ring-1 ring-line/10"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                      item.danger && !active && "text-danger-soft-foreground hover:bg-danger/5 hover:text-danger"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <span className="mx-1 hidden h-px bg-line/10 lg:block" aria-hidden />
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
