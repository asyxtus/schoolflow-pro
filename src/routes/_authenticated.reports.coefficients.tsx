import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listClassNames } from "@/lib/attendance.functions";
import {
  listCoefficients, upsertCoefficient, deleteCoefficient,
} from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/reports/coefficients")({
  component: CoefficientsPage,
});

function CoefficientsPage() {
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [coef, setCoef] = useState("1");
  const [teacher, setTeacher] = useState("");
  const qc = useQueryClient();

  const listClasses = useServerFn(listClassNames);
  const fetchList = useServerFn(listCoefficients);
  const save = useServerFn(upsertCoefficient);
  const remove = useServerFn(deleteCoefficient);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => listClasses() });
  const listQ = useQuery({
    queryKey: ["coefficients", className],
    queryFn: () => fetchList({ data: { className } }),
    enabled: !!className,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          className,
          subject: subject.trim(),
          coefficient: Number(coef) || 1,
          teacher_name: teacher.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setSubject(""); setCoef("1"); setTeacher("");
      qc.invalidateQueries({ queryKey: ["coefficients", className] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coefficients", className] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
        </Button>
      </div>
      <PageHeader
        title="Subject Coefficients"
        description="Set the weighting of each subject per class. Used by the bulletin engine."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a class to manage its subjects.</CardContent></Card>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_100px_1fr_auto]">
              <Input placeholder="Subject (e.g. Mathematics)" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Input placeholder="Coef" value={coef} onChange={(e) => setCoef(e.target.value)} inputMode="decimal" />
              <Input placeholder="Teacher (optional)" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
              <Button onClick={() => saveMut.mutate()} disabled={!subject.trim() || saveMut.isPending}>
                <Plus className="mr-2 h-4 w-4" />Add / Update
              </Button>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-24 text-center">Coefficient</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listQ.data?.coefficients ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.subject}</TableCell>
                    <TableCell className="text-center">{c.coefficient}</TableCell>
                    <TableCell>{c.teacher_name ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => delMut.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(listQ.data?.coefficients ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No subjects configured yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}