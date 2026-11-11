"use client";

import { Suspense } from "react";
import Link from "next/link";
import { AppSidebarNew } from "@/components/app/sidebar-shadcn";
import { BottomNav } from "@/components/app/bottom-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import { CommandSearch } from "@/components/app/command-search";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { InboxNotification } from "@/server/services/notifications";

interface AppShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    avatarUrl?: string | null;
  };
  inbox: InboxNotification[];
  unread: number;
  allowedMenus?: string[] | null;
  children: React.ReactNode;
}

export function AppShell({ user, inbox, unread, allowedMenus, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebarNew allowed={allowedMenus} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-xl sm:px-5 lg:px-6">
          <SidebarTrigger className="md:hidden" />
          <Link href="/dashboard" className="flex items-center gap-2.5 md:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/90 font-display text-sm font-extrabold text-primary-foreground">M</span>
            <span className="font-display text-[15px] font-bold tracking-tight">Madani Aqiqah</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <CommandSearch allowed={allowedMenus} />
            <NotificationBell items={inbox} unread={unread} />
            <Suspense fallback={null}>
              <UserMenu name={user.name} email={user.email} roles={user.roles} avatarUrl={user.avatarUrl ?? null} />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="w-full px-4 pt-5 pb-28 sm:px-5 lg:px-6 md:pb-8">{children}</div>
        </main>
        <BottomNav allowed={allowedMenus} />
      </SidebarInset>
    </SidebarProvider>
  );
}
