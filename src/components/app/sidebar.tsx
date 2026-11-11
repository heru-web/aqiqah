"use client";

import { useCallback, useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardListIcon,
  HouseIcon,
  LayoutGridIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Users2Icon,
  WalletIcon,
} from "lucide-react";
import { NAV_GROUPS } from "@/components/app/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const SIDEBAR_STORAGE_KEY = "ma3.sidebar.collapsed";
const SIDEBAR_EVENT = "ma3.sidebar.change";

function subscribeCollapsed(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_EVENT, onChange);
  };
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // abaikan
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function NavInner({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex-1 overflow-y-auto pb-6", collapsed ? "px-2" : "px-3")}>
      {NAV_GROUPS.map((group) => (
        <div key={group.group}>
          {!collapsed && (
            <p
              className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: group.color }}
            >
              {group.group}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-9 items-center rounded-lg border-l-[3px] border-transparent text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active
                        ? "bg-nav-active text-white"
                        : "text-nav-text hover:bg-nav-soft hover:text-nav-text-strong"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.module && (
                      <span className="ml-auto px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded-full bg-nav-soft text-nav-text">
                        {item.module}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-nav-line px-5 py-4 flex-shrink-0",
        collapsed && "flex-col gap-2 px-2 py-4"
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from to-brand-to font-display text-base font-extrabold text-white shadow">
        M
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-bold text-white">Madani Aqiqah</p>
          <p className="truncate text-[10px] tracking-[0.06em] text-slate-500">ERP \u00b7 Super Apps</p>
        </div>
      )}
      {onToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "Tampilkan menu" : "Sembunyikan menu"}
          title={collapsed ? "Tampilkan menu" : "Sembunyikan menu"}
          className={cn(
            "h-8 w-8 shrink-0 text-slate-400 hover:bg-nav-soft hover:text-white",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? <PanelLeftOpenIcon className="h-4 w-4" /> : <PanelLeftCloseIcon className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

export function AppSidebar() {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, getServerSnapshot);

  const toggle = useCallback(() => {
    writeCollapsed(!collapsed);
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex-col bg-nav transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64"
      )}
      style={{ width: collapsed ? "76px" : "256px", minWidth: collapsed ? "76px" : "256px" }}
    >
      <Brand collapsed={collapsed} onToggle={toggle} />
      <NavInner collapsed={collapsed} />
    </aside>
  );
}

function MobileSheetContent() {
  return (
    <SheetContent
      side="left"
      className="w-80 gap-0 border-nav-line bg-nav p-0 text-nav-text-strong [&>button]:text-slate-400 [&>button:hover]:text-white"
    >
      <SheetTitle className="sr-only">Navigasi</SheetTitle>
      <div className="border-b border-nav-line">
        <Brand />
      </div>
      <div className="pt-3">
        <NavInner />
      </div>
    </SheetContent>
  );
}

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu">
          <MenuIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <MobileSheetContent />
    </Sheet>
  );
}

const BOTTOM_TABS = [
  { href: "/dashboard", label: "Dasbor", icon: HouseIcon },
  { href: "/orders", label: "Pesanan", icon: ClipboardListIcon },
  { href: "/customers", label: "Pelanggan", icon: Users2Icon },
  { href: "/payments", label: "Pembayaran", icon: WalletIcon },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 md:hidden">
        <div className="grid grid-cols-5 rounded-2xl bg-nav/95 p-1.5 ring-1 ring-nav-line shadow-popover backdrop-blur-xl">
          {BOTTOM_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors",
                  active ? "bg-nav-active text-white" : "text-nav-text hover:text-nav-text-strong"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka semua menu"
            className="flex flex-col items-center gap-1 rounded-xl py-2 text-nav-text transition-colors hover:text-nav-text-strong"
          >
            <LayoutGridIcon className="h-[18px] w-[18px]" />
            <span className="text-[11px] font-semibold">Menu</span>
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <MobileSheetContent />
      </Sheet>
    </>
  );
}
