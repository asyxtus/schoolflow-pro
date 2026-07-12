import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listClassNames } from "@/lib/attendance.functions";
import { getGradesForClass, upsertGrade } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const DEFAULT_SUBJECTS = [
  "Mathematics", "English", "French", "Physics", "Chemistry",
  "Biology", "History", "Geography",
];

function ReportsPage() {
  const [className, setClassName] = useState("");
  const [sequence, setSequence] = useState(1);
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[0]);
  const qc = useQueryClient();

  const listClasses = useServerFn(listClassNames);
  const fetchGrades = useServerFn(getGradesForClass);
  const saveGrade = useServerFn(upsertGrade);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => listClasses() });
  const gradesQ = useQuery({
    queryKey: ["grades", className, sequence],
    queryFn: () => fetchGrades({ data: { className, sequence } }),
    enabled: !!className,
  });

  const saveMut = useMutation({
    mutationFn: (v: { studentId: string; ca?: number | null; exam?: number | null }) =>
      saveGrade({ data: { studentId: v.studentId, sequence, subject, ca_score: v.ca, exam_score: v.exam } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades", className, sequence] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const students = gradesQ.data?.students ?? [];
  const grades = gradesQ.data?.grades ?? [];

  const rows = useMemo(() => {
    return students.map((s) => {
      const g = grades.find((x) => x.student_id === s.id && x.subject === subject);
      const ca = g?.ca_score != null ? Number(g.ca_score) : null;
      const exam = g?.exam_score != null ? Number(g.exam_score) : null;
      const total = ca != null && exam != null ? Math.round((ca * 0.4 + exam * 0.6) * 10) / 10 : null;
      return { student: s, ca, exam, total };
    });
  }, [students, grades, subject]);

  const ranked = [...rows]
    .filter((r) => r.total != null)
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const rankMap = new Map(ranked.map((r, i) => [r.student.id, i + 1]));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Reports"
        description="Score entry, ranking and report cards"
        actions={<Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>}
      />

      <Card className="mb-4 print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Sequence</label>
            <Select value={String(sequence)} onValueChange={(v) => setSequence(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>Sequence {n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEFAULT_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a class to enter scores.</CardContent></Card>
      ) : !students.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No active students in this class.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="w-28">CA /100</TableHead>
                <TableHead className="w-28">Exam /100</TableHead>
                <TableHead className="w-24">Total</TableHead>
                <TableHead className="w-20 text-right">Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <ScoreRow
                  key={r.student.id}
                  name={`${r.student.last_name} ${r.student.first_name}`}
                  matricule={r.student.matricule}
                  ca={r.ca}
                  exam={r.exam}
                  total={r.total}
                  rank={rankMap.get(r.student.id) ?? null}
                  onSave={(ca, exam) => saveMut.mutate({ studentId: r.student.id, ca, exam })}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ScoreRow({
  name, matricule, ca, exam, total, rank, onSave,
}: {
  name: string; matricule: string | null;
  ca: number | null; exam: number | null; total: number | null;
  rank: number | null;
  onSave: (ca: number | null, exam: number | null) => void;
}) {
  const [caStr, setCa] = useState(ca?.toString() ?? "");
  const [examStr, setExam] = useState(exam?.toString() ?? "");

  const commit = () => {
    const nextCa = caStr.trim() === "" ? null : Number(caStr);
    const nextExam = examStr.trim() === "" ? null : Number(examStr);
    if ((nextCa != null && (isNaN(nextCa) || nextCa < 0 || nextCa > 100)) ||
        (nextExam != null && (isNaN(nextExam) || nextExam < 0 || nextExam > 100))) return;
    if (nextCa === ca && nextExam === exam) return;
    onSave(nextCa, nextExam);
  };

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{matricule ?? "—"}</TableCell>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell><Input value={caStr} onChange={(e) => setCa(e.target.value)} onBlur={commit} className="h-8 w-20" inputMode="decimal" /></TableCell>
      <TableCell><Input value={examStr} onChange={(e) => setExam(e.target.value)} onBlur={commit} className="h-8 w-20" inputMode="decimal" /></TableCell>
      <TableCell>{total != null ? <Badge variant={total >= 50 ? "default" : "secondary"}>{total}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-right font-medium">{rank ?? "—"}</TableCell>
    </TableRow>
  );
}