"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { NAV_GROUPS } from "@/components/app/nav";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

function Brand() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className={cn("flex items-center gap-3 border-b border-sidebar-border px-4 py-4", collapsed && "justify-center px-2")}>
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-from to-brand-to font-display text-sm font-extrabold text-white shadow">M</div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-bold text-sidebar-foreground">Madani Aqiqah</p>
          <p className="truncate text-[10px] tracking-[0.06em] text-sidebar-foreground/60">ERP · Super Apps</p>
        </div>
      )}
      <Button type="button" variant="ghost" size="icon" onClick={toggleSidebar} className={cn("ml-auto hidden h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex", collapsed && "ml-0")}>
        {collapsed ? <PanelLeftOpenIcon className="h-4 w-4" /> : <PanelLeftCloseIcon className="h-4 w-4" />}
      </Button>
    </div>
  );
}

const DASHBOARD_HREF = "/dashboard";

function visibleGroups(allowed?: string[] | null) {
  if (!allowed || allowed.length === 0) return NAV_GROUPS;
  const set = new Set(allowed.includes(DASHBOARD_HREF) ? allowed : [DASHBOARD_HREF, ...allowed]);
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => set.has(item.href)) })).filter(
    (group) => group.items.length > 0
  );
}

export function AppSidebarNew({ allowed }: { allowed?: string[] | null } = {}) {
  const pathname = usePathname();
  const groups = visibleGroups(allowed);
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-0"><Brand /></SidebarHeader>
      <SidebarContent className="px-1 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.group} className="px-2">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: group.color }}>{group.group}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href} className="flex items-center gap-1">
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={cn("sidebar-menu flex-1 min-w-0", active ? "bg-sidebar-primary text-sidebar-primary-foreground active" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2"
                        onClick={() => {
                          // autohide: tutup drawer di HP setelah item menu diklik
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.module && (
                          <span className="ml-auto hidden rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sidebar-foreground/70 md:inline-flex group-data-[collapsible=icon]:hidden">{item.module}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                    <Link
                      href={`/docs/buku-panduan?m=${encodeURIComponent(item.label)}`}
                      title={`Cara pakai: ${item.label}`}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                      className="group-data-[collapsible=icon]:hidden grid size-6 shrink-0 place-items-center rounded-md text-sidebar-foreground/45 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      aria-label={`Tutorial ${item.label}`}
                    >
                      <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2" />
      <SidebarRail />
    </Sidebar>
  );
}