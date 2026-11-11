"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface NamedValue {
  label: string;
  /** null = belum bisa dinilai (cakupan di bawah ambang). */
  value: number | null;
}

/** Bar chart horizontal sederhana (kontribusi unit, dsb). */
export function NamedBarChart({ data, name = "Nilai" }: { data: NamedValue[]; name?: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(27% 0.025 165 / 10%)" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5f6d66" }} />
          <YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5f6d66" }} />
          <Tooltip
            cursor={{ fill: "oklch(42% 0.065 168 / 6%)" }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid oklch(27% 0.025 165 / 12%)",
              boxShadow: "0 10px 24px -6px oklch(27% 0.025 165 / 0.12)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="value" name={name} radius={[0, 6, 6, 0]} fill="#0d7c66" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
