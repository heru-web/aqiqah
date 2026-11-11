export interface WaAlertRuleView {
  id: string;
  code: string;
  label: string;
  desc: string;
  enabled: boolean;
  sendHour: number;
  sendMinute: number;
  targetRoles: string;
  onlyWeekdays: boolean;
  template: string | null;
  lastSentAt: string | null;
}

export const TARGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SUPERADM", label: "Super Admin saja" },
  { value: "SUPERADM,SALES,MARKETING,CS", label: "Tim Penjualan (Sales & CS)" },
  { value: "SUPERADM,OPS", label: "Operasional" },
  { value: "SUPERADM,HR", label: "HR" },
  { value: "ALL", label: "Semua peran" },
];
