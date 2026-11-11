"use client";

import { useEffect, useState } from "react";
import { mermaidThemes } from "@/lib/mermaid-theme";

/** Merender diagram Mermaid (```mermaid di markdown) sebagai SVG interaktif. */
export function MermaidView({ chart, id }: { chart: string; id?: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const uid = `mmd-${(id ?? chart).length}-${chart.length}`;

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: mermaidThemes,
          fontFamily: "inherit",
          securityLevel: "strict",
          flowchart: { curve: "basis", padding: 12 },
        });
        const { svg: rendered } = await mermaid.render(uid, chart);
        if (!disposed) setSvg(rendered);
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Gagal merender diagram");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [chart, uid]);

  if (error) {
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-[#141d2b] p-3.5 text-xs leading-relaxed text-zinc-100">
        {chart}
      </pre>
    );
  }

  return (
    <figure className="mermaid-figure my-5 overflow-x-auto rounded-xl border border-line-warm bg-surface p-3">
      {svg ? (
        <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Memuat diagram…</div>
      )}
    </figure>
  );
}
