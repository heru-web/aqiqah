"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DayStat {
  label: string;
  orders: number;
}

export function OrdersWeeklyChart({ data }: { data: DayStat[] }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(27% 0.025 165 / 10%)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5f6d66" }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: "#5f6d66" }} />
          <Tooltip
            cursor={{ fill: "oklch(42% 0.065 168 / 6%)" }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid oklch(27% 0.025 165 / 12%)",
              boxShadow: "0 10px 24px -6px oklch(27% 0.025 165 / 0.12)",
              fontSize: 13,
            }}
          />
          <Bar dataKey="orders" name="Pesanan" radius={[6, 6, 0, 0]} fill="#0d7c66" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}