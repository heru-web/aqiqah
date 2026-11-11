"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CheckCheckIcon,
  ClipboardListIcon,
  GaugeIcon,
  ReceiptIcon,
  UserPlusIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import { cn } from "@/lib/utils";
import type { InboxNotification } from "@/server/services/notifications";

function iconFor(data: Record<string, unknown> | null) {
  if (data?.orderId) return { Icon: ClipboardListIcon, tone: "bg-primary/10 text-primary" };
  if (data?.paymentId) return { Icon: WalletIcon, tone: "bg-success/15 text-success-soft-foreground" };
  if (data?.invoiceId) return { Icon: ReceiptIcon, tone: "bg-gold/15 text-gold-soft-foreground" };
  if (data?.leadId) return { Icon: UserPlusIcon, tone: "bg-info-soft text-info-soft-foreground" };
  if (data?.kpiScope) return { Icon: GaugeIcon, tone: "bg-warning-soft text-warning-soft-foreground" };
  return { Icon: BellIcon, tone: "bg-muted text-muted-foreground" };
}

function hrefFor(data: Record<string, unknown> | null): string | null {
  if (typeof data?.orderId === "string") return `/orders/${data.orderId}`;
  if (typeof data?.leadId === "string") return `/crm/${data.leadId}`;
  if (typeof data?.paymentId === "string") return "/payments";
  if (typeof data?.invoiceId === "string") return "/invoices";
  return null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hr lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function NotificationBell({ items, unread }: { items: InboxNotification[]; unread: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-foreground/80 hover:text-foreground"
          aria-label={unread > 0 ? `Notifikasi (${unread} belum dibaca)` : "Notifikasi"}
        >
          <BellIcon className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-canvas">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line/10 px-4 py-3">
          <div>
            <p className="font-display text-sm font-bold text-foreground">Notifikasi</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => { void markAllNotificationsReadAction(); })}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              <CheckCheckIcon className="h-3.5 w-3.5" />
              Tandai dibaca
            </button>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellIcon className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">Belum ada notifikasi</p>
              <p className="text-xs text-muted-foreground">
                Pemberitahuan order baru dan aktivitas penting akan muncul di sini.
              </p>
            </div>
          ) : (
            items.map((n) => {
              const { Icon, tone } = iconFor(n.data);
              const href = hrefFor(n.data);
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => {
                    if (!n.isRead) {
                      startTransition(() => { void markNotificationReadAction(n.id); });
                    }
                    if (href) router.push(href);
                  }}
                  className={cn("items-start gap-3 p-2.5", !n.isRead && "bg-primary/5")}
                >
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="line-clamp-1 text-sm font-semibold text-foreground">{n.title}</span>
                      {!n.isRead && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
