import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export interface DocMeta {
  slug: string;
  file: string;
  title: string;
  description: string;
  audience: string;
}

/**
 * Whitelist dokumen yang boleh dirender — mencegah path traversal
 * karena slug tidak pernah dipakai langsung sebagai path.
 */
export const DOC_FILES: Record<string, DocMeta> = {
  "catatan-modul": {
    slug: "catatan-modul",
    file: "07-CATATAN-MODUL.md",
    title: "Catatan Semua Modul",
    description: "Table status semua modul & fitur yang sudah selesai — path, fitur inti, dan status setiap menu.",
    audience: "Semua pengguna",
  },

  "buku-panduan": {
    slug: "buku-panduan",
    file: "00-BUKU-PANDUAN-LENGKAP.md",
    title: "Tutorial Aplikasi",
    description: "Tutorial lengkap aplikasi: daftar isi, 21 bab modul & fitur, cara pakai bergambar & FAQ.",
    audience: "Semua pengguna",
  },

};

/** Pemetaan nama file markdown lokal → slug, untuk link antar dokumen. */
const FILE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.values(DOC_FILES).map((d) => [d.file, d.slug])
);

export function listDocs(): DocMeta[] {
  return Object.values(DOC_FILES);
}

export function getDocMeta(slug: string): DocMeta | null {
  return DOC_FILES[slug] ?? null;
}

/** Terjemahkan href markdown antar-dokumen (mis. "02-REFERENSI-MODUL.md") ke /docs/<slug>. */
export function docSlugForHref(href: string): string | null {
  const base = href.replace(/^.*\//, "");
  return FILE_TO_SLUG[base] ?? null;
}

export const readDocMarkdown = cache(async (slug: string): Promise<string | null> => {
  const meta = DOC_FILES[slug];
  if (!meta) return null;
  try {
    const filePath = path.join(process.cwd(), "docs", meta.file);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
});
