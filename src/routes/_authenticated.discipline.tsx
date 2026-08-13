import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Check, RotateCcw, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStudents } from "@/lib/students.functions";
import { useClassOptions } from "@/hooks/use-classes";
import {
  listDisciplineIncidents,
  resolveDisciplineIncident,
  reopenDisciplineIncident,
  deleteDisciplineIncident,
  type DisciplineStatus,
} from "@/lib/discipline.functions";
import { ReportIncidentDialog } from "@/components/report-incident-dialog";

export const Route = createFileRoute("/_authenticated/discipline")({
  component: DisciplinePage,
});

const severityVariant: Record<string, "default" | "secondary" | "destructive"> = {
  minor: "secondary",
  moderate: "default",
  major: "destructive",
};

function DisciplinePage() {
  const [status, setStatus] = useState<DisciplineStatus | "all">("open");
  const [className, setClassName] = useState<string>("all");
  const [reportOpen, setReportOpen] = useState(false);
  const qc = useQueryClient();

  const fetchStudents = useServerFn(getStudents);
  const fetchIncidents = useServerFn(listDisciplineIncidents);
  const resolveFn = useServerFn(resolveDisciplineIncident);
  const reopenFn = useServerFn(reopenDisciplineIncident);
  const deleteFn = useServerFn(deleteDisciplineIncident);

  const { data: classes } = useClassOptions();
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const listQ = useQuery({
    queryKey: ["discipline-incidents", status, className],
    queryFn: () =>
      fetchIncidents({
        data: {
          status: status === "all" ? undefined : status,
          className: className === "all" ? undefined : className,
        },
      }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["discipline-incidents"], exact: false });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="Discipline"
        description="Incident log — visible to all staff, editable by leadership or the discipline master."
        actions={
          <Button onClick={() => setReportOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Report incident
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as DisciplineStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24">Severity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data ?? []).map((r) => {
              const s = (
                r as {
                  students?: {
                    first_name?: string;
                    last_name?: string;
                    class_name?: string;
                    matricule?: string;
                  };
                }
              ).students;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.occurred_on).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s ? (
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: r.student_id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {s.first_name} {s.last_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {s?.class_name && (
                      <div className="text-xs text-muted-foreground">{s.class_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.category}</TableCell>
                  <TableCell>
                    <Badge
                      variant={severityVariant[r.severity] ?? "secondary"}
                      className="capitalize"
                    >
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {r.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "open" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {r.status === "open" ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Mark resolved"
                          onClick={async () => {
                            try {
                              await resolveFn({ data: { id: r.id } });
                              invalidate();
                              toast.success("Marked resolved");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Reopen"
                          onClick={async () => {
                            try {
                              await reopenFn({ data: { id: r.id } });
                              invalidate();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={async () => {
                          try {
                            await deleteFn({ data: { id: r.id } });
                            invalidate();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(listQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No incidents match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ReportIncidentDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        students={studentsQ.data ?? []}
        onReported={invalidate}
      />
    </div>
  );
}
