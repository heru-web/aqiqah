"use client";

import { Button } from "@/components/ui/button";
import { DownloadIcon, FileTextIcon } from "lucide-react";

export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Tombol Export Excel/PDF generik untuk tabel mana pun.
 * rows sudah berbentuk {key: nilai} datar (hasil map per modul).
 */
export function TableExportButtons({
  filename,
  rows,
  columns,
  sheetName = "Data",
}: {
  filename: string;
  rows: Array<Record<string, unknown>>;
  columns: ExportColumn[];
  sheetName?: string;
}) {
  function flatten(row: Record<string, unknown>): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      const v = row[col.key];
      out[col.label] =
        v === null || v === undefined
          ? ""
          : typeof v === "number"
            ? v
            : typeof v === "string"
              ? v
              : String(v);
    }
    return out;
  }

  async function exportExcel() {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const data = rows.map(flatten);
    const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });
    ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    download(new Blob([buf]), `${filename}.xlsx`);
  }

  async function exportPdf() {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    autoTable(doc, {
      head: [columns.map((c) => c.label.toUpperCase())],
      body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [27, 94, 32] },
    });
    download(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), `${filename}.pdf`);
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface/70 p-1 ring-1 ring-line/10 shadow-sm">
      <Button variant="outline" size="compact" title="Unduh Excel (.xlsx)" onClick={() => void exportExcel()}>
        <DownloadIcon className="h-3.5 w-3.5" />
        Excel
      </Button>
      <Button variant="outline" size="compact" title="Unduh PDF" onClick={() => void exportPdf()}>
        <FileTextIcon className="h-3.5 w-3.5" />
        PDF
      </Button>
    </div>
  );
}
