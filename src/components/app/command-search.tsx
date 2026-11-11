"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { NAV_GROUPS } from "@/components/app/nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { moduleGroupColor } from "@/lib/module-colors";

interface FlatItem {
  href: string;
  label: string;
  group: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export function CommandSearch({ allowed }: { allowed?: string[] | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<FlatItem[]>(() => {
    const set = allowed ? new Set(allowed) : null;
    return NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => !set || set.has(i.href))
        .map((i) => ({ href: i.href, label: i.label, group: g.group, Icon: i.icon }))
    );
  }, [allowed]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => `${i.group} ${i.label} ${i.href}`.toLowerCase().includes(needle));
  }, [items, q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
        onClick={() => setOpen(true)}
        title="Cari menu (Ctrl+K)"
        aria-label="Cari menu"
      >
        <SearchIcon className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Pencarian Menu</DialogTitle>
          <DialogDescription>Cari dan buka menu (Ctrl+K)</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) go(filtered[0].href);
            }}
            placeholder="Cari halaman… (nama modul atau grup)"
            className="h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden rounded-md border border-line bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">Esc</kbd>
        </div>
        <div className="max-h-[58vh] overflow-y-auto py-2">
          {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Tidak ada menu cocok.</p>}
          {filtered.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => go(item.href)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg text-white"
                style={{ backgroundColor: moduleGroupColor(item.group) }}
              >
                <item.Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="truncate font-medium">{item.label}</span>
              <span className="ml-auto truncate text-[10.5px] uppercase tracking-wide text-muted-foreground">{item.group}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
