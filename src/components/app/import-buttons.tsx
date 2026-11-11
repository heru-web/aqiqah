"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadIcon } from "lucide-react";

export interface ImportColumn {
  label: string;
  key: string;
  example: string;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Tombol Template + Import generik: satu kolom = satu key payload. */
export function ImportExportButtons({
  endpoint,
  filename,
  columns,
  label = "Import",
  extraTemplateNote,
}: {
  endpoint: string;
  filename: string;
  columns: ImportColumn[];
  label?: string;
  extraTemplateNote?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  async function doTemplate() {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const header = columns.map((c) => c.label);
    const example: Record<string, string> = {};
    for (const c of columns) example[c.label] = c.example;
    const ws = XLSX.utils.json_to_sheet([example], { header });
    ws["!cols"] = header.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    downloadBlob(new Blob([buf]), `template-${filename}.xlsx`);
  }

  async function onFile(file: File) {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const byLabel = new Map(columns.map((c) => [c.label.toLowerCase(), c.key]));
    const rows: Array<Record<string, string>> = [];
    for (const raw of json) {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = byLabel.get(k.toLowerCase());
        if (key && v !== null && String(v).trim() !== "") row[key] = String(v).trim();
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    if (rows.length === 0) return;
    const res = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <Input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="compact" onClick={() => fileRef.current?.click()}>
        <UploadIcon className="h-3.5 w-3.5" />
        {label}
      </Button>
      <Button variant="ghost" size="compact" title={extraTemplateNote ?? "Unduh contoh format pengisian"} onClick={() => void doTemplate()}>
        Template
      </Button>
    </>
  );
}
