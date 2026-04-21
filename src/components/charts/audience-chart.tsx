"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";

type AudienceRow = {
  ageGroup: string;
  male: number;
  female: number;
  other: number;
};

/**
 * Stacked bar: x-axis = age bucket, stacked by gender.
 * Reads YouTubeAudienceSnapshot rows where viewerPercentage is 0..100
 * and the sum across (age, gender) for a single periodEnd = 100%.
 */
export function AudienceChart({
  rows,
  height = 260,
}: {
  rows: {
    ageGroup: string;
    gender: string;
    viewerPercentage: number;
  }[];
  height?: number;
}) {
  // Pivot into rows keyed by age group
  const map = new Map<string, AudienceRow>();
  for (const r of rows) {
    const key = prettyAge(r.ageGroup);
    if (!map.has(key)) {
      map.set(key, { ageGroup: key, male: 0, female: 0, other: 0 });
    }
    const bucket = map.get(key)!;
    if (r.gender === "male") bucket.male += r.viewerPercentage;
    else if (r.gender === "female") bucket.female += r.viewerPercentage;
    else bucket.other += r.viewerPercentage;
  }

  // Order age buckets
  const order = [
    "13-17",
    "18-24",
    "25-34",
    "35-44",
    "45-54",
    "55-64",
    "65+",
  ];
  const data = order
    .map((label) => map.get(label))
    .filter((x): x is AudienceRow => !!x);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.grid}
          vertical={false}
        />
        <XAxis
          dataKey="ageGroup"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          width={40}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => `${Number(v).toFixed(1)}%`}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => (
            <span className="text-xs text-muted-foreground">{v}</span>
          )}
        />
        <Bar
          dataKey="male"
          name="Male"
          stackId="a"
          fill="#6366f1"
          radius={[0, 0, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="female"
          name="Female"
          stackId="a"
          fill="#f472b6"
          maxBarSize={32}
        />
        <Bar
          dataKey="other"
          name="Other"
          stackId="a"
          fill="#a3a3a3"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function prettyAge(raw: string): string {
  // YouTube returns values like "age18-24" or "age65-"
  const v = raw.replace(/^age/, "");
  if (v === "65-") return "65+";
  return v;
}
