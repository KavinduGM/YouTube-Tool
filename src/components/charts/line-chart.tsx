"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";

type Series = {
  key: string;
  label: string;
  color?: string;
  /** If true, fill under the line (area). */
  area?: boolean;
  /** Default is integer formatting; override for currency/duration. */
  format?: (v: number) => string;
};

export function TimeSeriesChart({
  data,
  series,
  height = 260,
  yTickFormatter,
}: {
  data: Array<Record<string, string | number | null | undefined>>;
  series: Series[];
  height?: number;
  yTickFormatter?: (v: number) => string;
}) {
  const hasArea = series.some((s) => s.area);
  const ChartRoot = hasArea ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartRoot data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient
              key={s.key}
              id={`g-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={s.color ?? paletteAt(i)}
                stopOpacity={0.25}
              />
              <stop
                offset="100%"
                stopColor={s.color ?? paletteAt(i)}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.grid}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => format(parseISO(String(v)), "MMM d")}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) =>
            yTickFormatter ? yTickFormatter(v) : formatNumber(Number(v))
          }
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => format(parseISO(String(v)), "MMM d, yyyy")}
          formatter={(value, _name, item) => {
            const s = series.find((x) => x.key === item.dataKey);
            const fmt = s?.format ?? ((n: number) => formatNumber(Number(n)));
            return [fmt(Number(value)), s?.label ?? String(item.dataKey)];
          }}
        />
        {series.map((s, i) =>
          s.area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color ?? paletteAt(i)}
              strokeWidth={2}
              fill={`url(#g-${s.key})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color ?? paletteAt(i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )
        )}
      </ChartRoot>
    </ResponsiveContainer>
  );
}

function paletteAt(i: number) {
  const p = [
    "#6366f1",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
  ];
  return p[i % p.length];
}
