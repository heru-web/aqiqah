"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, FileTextIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type CustomerImportRow = {
  name: string;
  type?: "PERUSAHAAN" | "PERORANGAN";
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  npwp?: string;
  source?: string;
  notes?: string;
};

function norm(v: string): string {
  return v.toLowerCase().replace(/[\s_]+/g, "");
}

function toCustomerImportRow(raw: Record<string, unknown>): CustomerImportRow | null {
  const rec: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== "") rec[norm(k)] = s;
  }
  const get = (keys: string[]): string | undefined => {
    for (const key of keys) {
      if (rec[key] !== undefined) return rec[key];
    }
    return undefined;
  };
  const name = get(["nama", "name", "pelanggan", "customer", "namapelanggan", "customername"]);
  if (!name) return null;
  const typeRaw = get(["tipe", "type", "jenis"]);
  const type = typeRaw && /lembaga|perusahaan|company|usaha|business/i.test(typeRaw) ? "PERUSAHAAN" : "PERORANGAN";
  return {
    name,
    type,
    phone: get(["telepon", "phone", "hp", "nohp", "phonenumber"]),
    whatsapp: get(["whatsapp", "wa"]),
    email: get(["email"]),
    address: get(["alamat", "address", "jalan", "alamatlengkap"]),
    city: get(["kota", "city"]),
    province: get(["provinsi", "province"]),
    npwp: get(["npwp"]),
    source: get(["source", "sumber"]),
    notes: get(["catatan", "notes", "keterangan"]),
  };
}

export function CustomerExportImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport(format: "excel" | "pdf") {
    const res = await fetch(`/api/customers/export?format=${format}`, { credentials: "include" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "excel" ? "pelanggan.xlsx" : "pelanggan.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File) {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const rows: CustomerImportRow[] = [];
    for (const raw of json) {
      const row = toCustomerImportRow(raw);
      if (row) rows.push(row);
    }
    if (rows.length === 0) return;
    const res = await fetch("/api/customers/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (res.ok) router.refresh();
  }

  async function doTemplate() {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const headers = ["Nama", "Tipe", "Telepon", "WhatsApp", "Email", "Alamat", "Kota", "Provinsi", "NPWP", "Sumber", "Catatan"];
    const rows = [
      { Nama: "Bpk. Ahmad Faizi", Tipe: "PERORANGAN", Telepon: "0812-xxxx-xxxx", WhatsApp: "0812-xxxx-xxxx", Email: "nama@email.com", Alamat: "Jl. Contoh No. 12", Kota: "Bandung", Provinsi: "Jawa Barat", NPWP: "", Sumber: "REFERRAL", Catatan: "Contoh baris — boleh dihapus" },
      { Nama: "Yayasan Contoh Sejahtera", Tipe: "PERUSAHAAN", Telepon: "021-xxxx-xxxx", WhatsApp: "0813-xxxx-xxxx", Email: "info@email.com", Alamat: "Jl. Contoh Raya 8", Kota: "Jakarta", Provinsi: "DKI Jakarta", NPWP: "00.000.000.0-000.000", Sumber: "ADS", Catatan: "Contoh baris — boleh dihapus" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-pelanggan.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => void doExport("excel")}>
        <DownloadIcon className="h-4 w-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => void doExport("pdf")}>
        <FileTextIcon className="h-4 w-4" />
        PDF
      </Button>
      <Input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <UploadIcon className="h-4 w-4" />
        Import
      </Button>
      <Button variant="ghost" size="sm" title="Unduh contoh format pengisian" onClick={() => void doTemplate()}>
        Template
      </Button>
    </div>
  );
}
/** Tombol Impor & Template saja — menyatu di pita export DataTable. */
export function CustomerImportExtra() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  async function doTemplate() {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const headers = ["Nama", "Tipe", "Telepon", "WhatsApp", "Email", "Alamat", "Kota", "Provinsi", "NPWP", "Sumber", "Catatan"];
    const rows = [
      { Nama: "Bpk. Ahmad Faizi", Tipe: "PERORANGAN", Telepon: "0812-xxxx-xxxx", WhatsApp: "0812-xxxx-xxxx", Email: "nama@email.com", Alamat: "Jl. Contoh No. 12", Kota: "Bandung", Provinsi: "Jawa Barat", NPWP: "", Sumber: "REFERRAL", Catatan: "Contoh baris — boleh dihapus" },
      { Nama: "Yayasan Contoh Sejahtera", Tipe: "PERUSAHAAN", Telepon: "021-xxxx-xxxx", WhatsApp: "0813-xxxx-xxxx", Email: "info@email.com", Alamat: "Jl. Contoh Raya 8", Kota: "Jakarta", Provinsi: "DKI Jakarta", NPWP: "00.000.000.0-000.000", Sumber: "ADS", Catatan: "Contoh baris — boleh dihapus" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "template-import-pelanggan.xlsx");
  }

  async function onImportFile(file: File) {
    const XLSX = (await import("xlsx")) as typeof import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const rows: CustomerImportRow[] = [];
    for (const raw of json) {
      const row = toCustomerImportRow(raw);
      if (row) rows.push(row);
    }
    if (rows.length === 0) return;
    const res = await fetch("/api/customers/import", {
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
          if (f) void onImportFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="compact" onClick={() => fileRef.current?.click()}>
        <UploadIcon className="h-3.5 w-3.5" />
        Import
      </Button>
      <Button variant="ghost" size="compact" title="Unduh contoh format pengisian" onClick={() => void doTemplate()}>
        Template
      </Button>
    </>
  );
}
