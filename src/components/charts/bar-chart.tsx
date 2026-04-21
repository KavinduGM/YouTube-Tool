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
import { formatNumber } from "@/lib/utils";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";

export function HorizontalBarChart({
  data,
  nameKey,
  valueKey,
  valueLabel,
  height = 260,
  color = "#6366f1",
  formatValue,
}: {
  data: Array<Record<string, string | number>>;
  nameKey: string;
  valueKey: string;
  valueLabel: string;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.grid}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            formatValue ? formatValue(Number(v)) : formatNumber(Number(v))
          }
        />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            formatValue
              ? formatValue(Number(value))
              : formatNumber(Number(value)),
            valueLabel,
          ]}
        />
        <Bar
          dataKey={valueKey}
          fill={color}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VerticalBarChart({
  data,
  nameKey,
  valueKey,
  valueLabel,
  height = 240,
  color = "#6366f1",
  formatValue,
}: {
  data: Array<Record<string, string | number>>;
  nameKey: string;
  valueKey: string;
  valueLabel: string;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.grid}
          vertical={false}
        />
        <XAxis
          dataKey={nameKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            formatValue ? formatValue(Number(v)) : formatNumber(Number(v))
          }
          width={48}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            formatValue
              ? formatValue(Number(value))
              : formatNumber(Number(value)),
            valueLabel,
          ]}
        />
        <Bar dataKey={valueKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
