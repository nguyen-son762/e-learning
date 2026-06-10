"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useProgressHistory } from "@/hooks/useProgressHistory";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Window = "7" | "30";

function formatTick(date: string): string {
  // Input is YYYY-MM-DD (UTC). Render dd/MM without timezone surprises.
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function ChartBody({ days }: { days: 7 | 30 }) {
  const { data, loading, error } = useProgressHistory(days);

  if (loading) return <Skeleton className="h-[250px] w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  const allZero = data.items.every((i) => i.count === 0);
  if (allZero) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-[var(--muted-foreground)]">
        Bắt đầu học để xem tiến độ
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data.items} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <Tooltip
          cursor={{ fill: "var(--secondary)" }}
          labelFormatter={(v) => formatTick(String(v))}
          formatter={(v) => [`${v} thẻ`, "Đã thuộc"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProgressChart() {
  const [tab, setTab] = useState<Window>("7");
  const days = tab === "7" ? 7 : 30;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Tiến độ học</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Window)}>
          <TabsList>
            <TabsTrigger value="7">7 ngày</TabsTrigger>
            <TabsTrigger value="30">30 ngày</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Card>
        <CardContent className="p-4">
          <ChartBody days={days} />
        </CardContent>
      </Card>
    </section>
  );
}
