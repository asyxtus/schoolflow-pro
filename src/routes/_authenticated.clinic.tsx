import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Check, Trash2 } from "lucide-react";

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
import { listClinicVisits, resolveClinicFollowUp, deleteClinicVisit } from "@/lib/clinic.functions";
import { RecordVisitDialog } from "@/components/record-visit-dialog";

export const Route = createFileRoute("/_authenticated/clinic")({
  component: ClinicPage,
});

function ClinicPage() {
  const [className, setClassName] = useState<string>("all");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const qc = useQueryClient();

  const fetchStudents = useServerFn(getStudents);
  const fetchVisits = useServerFn(listClinicVisits);
  const resolveFn = useServerFn(resolveClinicFollowUp);
  const deleteFn = useServerFn(deleteClinicVisit);

  const { data: classes } = useClassOptions();
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const listQ = useQuery({
    queryKey: ["clinic-visits", className, followUpOnly],
    queryFn: () =>
      fetchVisits({
        data: { className: className === "all" ? undefined : className, followUpOnly },
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clinic-visits"], exact: false });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="Clinic"
        description="Visit log — visible to the nurse and leadership only."
        actions={
          <Button onClick={() => setRecordOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record visit
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
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
          <Button
            size="sm"
            variant={followUpOnly ? "default" : "outline"}
            onClick={() => setFollowUpOnly((v) => !v)}
          >
            Needs follow-up only
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Treatment</TableHead>
              <TableHead className="w-24">Referred</TableHead>
              <TableHead className="w-28">Follow-up</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data ?? []).map((v) => {
              const s = (
                v as {
                  students?: { first_name?: string; last_name?: string; class_name?: string };
                }
              ).students;
              return (
                <TableRow key={v.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(v.visited_on).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s ? (
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: v.student_id }}
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
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {v.complaint}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {v.treatment_given ?? "—"}
                  </TableCell>
                  <TableCell>
                    {v.referred_out ? <Badge variant="destructive">Referred</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    {v.follow_up_needed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await resolveFn({ data: { id: v.id } });
                            invalidate();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Clear
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete"
                      onClick={async () => {
                        try {
                          await deleteFn({ data: { id: v.id } });
                          invalidate();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(listQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No visits match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <RecordVisitDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        students={studentsQ.data ?? []}
        onRecorded={invalidate}
      />
    </div>
  );
}
