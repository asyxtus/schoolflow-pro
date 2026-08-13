import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTrends, getBoardReportSnapshot } from "@/lib/trends.functions";
import { generateBoardReportPdf } from "@/lib/board-report-pdf";

export const Route = createFileRoute("/_authenticated/trends")({
  component: TrendsPage,
});

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function TrendChart({
  title,
  data,
  kind = "line",
  valueFormatter,
}: {
  title: string;
  data: { month: string; value: number }[];
  kind?: "line" | "bar";
  valueFormatter?: (v: number) => string;
}) {
  const chartData = data.map((d) => ({ label: monthLabel(d.month), value: d.value }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
                <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendsPage() {
  const [exporting, setExporting] = useState(false);
  const fetchTrends = useServerFn(getTrends);
  const fetchSnapshot = useServerFn(getBoardReportSnapshot);

  const trendsQ = useQuery({ queryKey: ["trends"], queryFn: () => fetchTrends({ data: {} }) });
  const snapshotQ = useQuery({ queryKey: ["board-snapshot"], queryFn: () => fetchSnapshot() });

  const exportPdf = async () => {
    if (!trendsQ.data || !snapshotQ.data) return;
    setExporting(true);
    try {
      generateBoardReportPdf({ snapshot: snapshotQ.data, trends: trendsQ.data });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="Trends & Board Reports"
        description="12-month trends across enrollment, fees, attendance, discipline, and the clinic."
        actions={
          <Button onClick={exportPdf} disabled={exporting || !trendsQ.data || !snapshotQ.data}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export board report (PDF)"}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active students" value={snapshotQ.data?.activeStudents ?? "—"} />
        <StatCard label="Active staff" value={snapshotQ.data?.activeStaff ?? "—"} />
        <StatCard
          label="Open discipline incidents"
          value={snapshotQ.data?.openDisciplineIncidents ?? "—"}
        />
        <StatCard
          label="Clinic visits (30 days)"
          value={snapshotQ.data?.clinicVisitsLast30Days ?? "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrendChart title="New enrollments" data={trendsQ.data?.enrollments ?? []} kind="bar" />
        <TrendChart
          title="Fee collections (FCFA)"
          data={trendsQ.data?.collections ?? []}
          valueFormatter={(v) => `${v.toLocaleString()} FCFA`}
        />
        <TrendChart
          title="Attendance rate (%)"
          data={trendsQ.data?.attendanceRate ?? []}
          valueFormatter={(v) => `${v}%`}
        />
        <TrendChart title="Discipline incidents" data={trendsQ.data?.discipline ?? []} kind="bar" />
        <TrendChart title="Clinic visits" data={trendsQ.data?.clinicVisits ?? []} kind="bar" />
      </div>
    </div>
  );
}
