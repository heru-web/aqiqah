/** Warna informatif per grup modul — dipakai sidebar label & chip header halaman. */
export const MODULE_GROUP_COLORS: Record<string, string> = {
  Utama: "#0d7c66",
  Penjualan: "#b8536c",
  Operasional: "#e8a317",
  Kepegawaian: "#5b8c3e",
  "Manajemen Kinerja": "#7a6fa8",
  "Keuangan & Akuntansi": "#39678f",
  "Program Sosial": "#b8544b",
  Sistem: "#64748b",
};

export function moduleGroupColor(group: string): string {
  return MODULE_GROUP_COLORS[group] ?? "#64748b";
}
