"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SimpleDoc {
  slug: string;
  title: string;
  description: string;
  audience: string;
}

/** Filter kartu dokumen di /docs. */
export function DocsCardsFilter({ docs }: { docs: SimpleDoc[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) => `${d.title} ${d.description} ${d.audience}`.toLowerCase().includes(needle));
  }, [docs, q]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari tutorial — mis. voucher, pengiriman, tutup periode…"
          className="h-10 w-full rounded-xl bg-surface/70 px-9 text-sm text-foreground ring-1 ring-line transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        {q && (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => setQ("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-xl bg-surface/60 px-4 py-3 text-sm text-muted-foreground ring-1 ring-line/10">
          Tidak ada dokumen cocok. Coba kata lain (mis. pelanggan, piutang, pengiriman).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((doc) => (
          <a key={doc.slug} href={`/docs/${doc.slug}`} className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="flex flex-col gap-2.5 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
                    <BookOpenIcon className="h-4 w-4 text-primary" />
                  </span>
                  <h2 className="font-display text-base font-bold text-foreground">{doc.title}</h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{doc.description}</p>
                <div className="mt-auto pt-1">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {doc.audience}
                  </span>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Cari & lompat ke bagian tutorial di halaman ini (data-doc-content). */
export function TutorialSearch({ headings, focusLabel }: { headings: string[]; focusLabel?: string }) {
  const [q, setQ] = useState("");

  const all = useMemo(() => headings, [headings]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return all.filter((h) => h.toLowerCase().includes(needle)).slice(0, 12);
  }, [all, q]);

  function jumpTo(label: string) {
    const root = document.querySelector("[data-doc-content]");
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("h2, h3"));
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    let target = nodes.find((n) => norm(n.textContent ?? "") === norm(label));
    if (!target) target = nodes.find((n) => norm(n.textContent ?? "").startsWith(norm(label)));
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    const original = target.style.backgroundColor;
    target.style.backgroundColor = "rgba(233, 75, 22, 0.12)";
    window.setTimeout(() => {
      target.style.backgroundColor = original;
    }, 1400);
  }

  useEffect(() => {
    if (!focusLabel) return;
    const timer = window.setTimeout(() => jumpTo(focusLabel), 300);
    return () => window.clearTimeout(timer);
    // jumpTo stabil: hanya dipanggil sekali saat masuk dengan ?m=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLabel]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari bagian dalam tutorial — mis. voucher, kandang, tutup periode…"
          className="h-10 w-full rounded-xl bg-surface/70 px-9 text-sm text-foreground ring-1 ring-line transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        {q && (
          <button
            type="button"
            aria-label="Bersihkan"
            onClick={() => setQ("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((h) => (
            <Button key={h} size="compact" variant="outline" type="button" onClick={() => jumpTo(h)}>
              {h}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Scroll ke bagian berdasarkan ?m= label heading (dipakai ikon tutorial di sidebar). */
export function TutorialFocusOnMount({ focusLabel }: { focusLabel?: string }) {
  useEffect(() => {
    if (!focusLabel) return;
    const timer = window.setTimeout(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("h2, h3"));
      const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const target =
        nodes.find((n) => norm(n.textContent ?? "") === norm(focusLabel)) ??
        nodes.find((n) => norm(n.textContent ?? "").startsWith(norm(focusLabel)));
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const original = target.style.backgroundColor;
      target.style.backgroundColor = "rgba(233, 75, 22, 0.12)";
      window.setTimeout(() => {
        target.style.backgroundColor = original;
      }, 1400);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [focusLabel]);
  return null;
}
