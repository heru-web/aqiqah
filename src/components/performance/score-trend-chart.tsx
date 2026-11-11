"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ScorePoint {
  label: string;
  /** null = periode belum bisa dinilai (cakupan di bawah ambang). */
  score: number | null;
}

/** Grafik garis skor (palet sage) — dipakai dasbor kinerja. */
export function ScoreTrendChart({ data }: { data: ScorePoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(27% 0.025 165 / 10%)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5f6d66" }} />
          <YAxis domain={[0, 120]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5f6d66" }} />
          <Tooltip
            cursor={{ stroke: "oklch(42% 0.065 168 / 30%)" }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid oklch(27% 0.025 165 / 12%)",
              boxShadow: "0 10px 24px -6px oklch(27% 0.025 165 / 0.12)",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Skor"
            stroke="#0d7c66"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#0d7c66" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
