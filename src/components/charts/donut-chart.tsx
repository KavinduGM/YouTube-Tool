"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import { CHART_PALETTE, TOOLTIP_STYLE } from "./chart-theme";

export function DonutChart({
  data,
  nameKey,
  valueKey,
  height = 240,
}: {
  data: Array<Record<string, string | number>>;
  nameKey: string;
  valueKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="55%"
          outerRadius="85%"
          stroke="hsl(var(--background))"
          strokeWidth={2}
          paddingAngle={1}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: unknown) => formatNumber(Number(value))}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(v) => (
            <span className="text-xs text-muted-foreground">{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
