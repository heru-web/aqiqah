"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface FinanceTrendPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
}

function shortRupiah(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} jt`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)} rb`;
  return String(value);
}

export function FinanceTrendChart({ data }: { data: FinanceTrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(27% 0.025 165 / 10%)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5f6d66" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#5f6d66" }} tickFormatter={shortRupiah} />
          <Tooltip
            cursor={{ fill: "oklch(42% 0.065 168 / 6%)" }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid oklch(27% 0.025 165 / 12%)",
              boxShadow: "0 10px 24px -6px oklch(27% 0.025 165 / 0.12)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="income" name="Pendapatan" radius={[5, 5, 0, 0]} fill="#0d7c66" />
          <Bar dataKey="expense" name="Beban" radius={[5, 5, 0, 0]} fill="#1a2332" />
          <Line type="monotone" dataKey="profit" name="Laba" stroke="#31835d" strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
