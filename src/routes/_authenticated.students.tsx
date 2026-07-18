import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download, Plus, Search, UserPlus } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatFCFA } from "@/lib/mock/students";
import type { Tables } from "@/integrations/supabase/types";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  class: z.string().optional().default("all"),
  fees: z.enum(["all", "paid", "overdue"]).optional().default("all"),
  status: z.enum(["all", "active", "inactive", "graduated", "withdrawn", "suspended"]).optional().default("all"),
});

const studentsQueryOptions = () => ({
  queryKey: ["students"] as const,
  queryFn: () => getStudents(),
});

export const Route = createFileRoute("/_authenticated/students")({
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(studentsQueryOptions());
  },
  component: StudentsPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Couldn't load students</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function StudentsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/students" });
  const { data: students } = useSuspenseQuery(studentsQueryOptions());

  const classOptions = useMemo(() => {
    const classes = Array.from(
      new Set((students ?? []).map((s) => s.class_name).filter((c): c is string => Boolean(c))),
    );
    return ["all", ...classes];
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      if (search.class !== "all" && s.class_name !== search.class) return false;
      if (search.fees !== "all") {
        const paid = (s.fee_balance ?? 0) === 0;
        if (search.fees === "paid" && !paid) return false;
        if (search.fees === "overdue" && paid) return false;
      }
      if (search.status !== "all" && s.status !== search.status) return false;
      if (!q) return true;
      return (
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q) ||
        (s.guardian_phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, students]);

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Students"
        description={`${(students ?? []).length} enrolled learners across ${new Set((students ?? []).map((s) => s.class_name)).size} classes`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button asChild size="sm">
              <Link to="/students/new">
                <UserPlus className="mr-2 h-4 w-4" /> Add student
              </Link>
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/40 p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search.q}
              onChange={(e) => setSearch({ q: e.target.value })}
              placeholder="Search name, matricule or guardian…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={search.class} onValueChange={(v) => setSearch({ class: v })}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              {classOptions.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "All classes" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={search.fees} onValueChange={(v) => setSearch({ fees: v as typeof search.fees })}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Fees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fees</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={search.status} onValueChange={(v) => setSearch({ status: v as typeof search.status })}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="graduated">Graduated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Student</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <StudentRow key={s.id} student={s} onOpen={(id) => navigate({ to: "/students/$studentId", params: { studentId: id } })} />
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    No students match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
            <span className="font-medium text-foreground">{(students ?? []).length}</span> students
          </span>
          <Button variant="ghost" size="sm" className="text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> Load more
          </Button>
        </div>
      </Card>
    </div>
  );
}

type StudentRow = Tables<"students">;
type FeeStatus = "paid" | "overdue";
type StudentStatus = StudentRow["status"];

function deriveFeeStatus(balance: number): FeeStatus {
  return balance === 0 ? "paid" : "overdue";
}

function StudentRow({ student, onOpen }: { student: StudentRow; onOpen: (id: string) => void }) {
  const initials = (student.first_name[0] ?? "") + (student.last_name[0] ?? "");
  const feeStatus = deriveFeeStatus(student.fee_balance ?? 0);
  return (
    <TableRow className="group cursor-pointer hover:bg-muted/30" onClick={() => onOpen(student.id)}>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="w-1 self-stretch rounded-full bg-primary/70 opacity-0 transition group-hover:opacity-100" />
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground group-hover:text-primary">
              {student.last_name} {student.first_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {student.gender === "male" ? "Male" : student.gender === "female" ? "Female" : "—"} · Born{" "}
              {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{student.matricule}</TableCell>
      <TableCell>
        <div className="text-sm text-foreground">{student.class_name}</div>
        <div className="text-xs text-muted-foreground">{student.section ?? "—"}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-foreground">{student.guardian_phone ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{student.guardian_email ?? ""}</div>
      </TableCell>
      <TableCell>
        <AttendanceBadge rate={student.attendance_rate ?? 0} />
      </TableCell>
      <TableCell>
        <FeePill status={feeStatus} balance={student.fee_balance ?? 0} />
      </TableCell>
      <TableCell>
        <StatusPill status={student.status} />
      </TableCell>
    </TableRow>
  );
}

function AttendanceBadge({ rate }: { rate: number }) {
  const tone =
    rate >= 95 ? "text-primary" : rate >= 85 ? "text-foreground" : "text-destructive";
  return <span className={`text-sm font-medium ${tone}`}>{rate}%</span>;
}

function FeePill({ status, balance }: { status: FeeStatus; balance: number }) {
  const map: Record<FeeStatus, string> = {
    paid: "bg-primary/10 text-primary border-primary/20",
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const label = status === "paid" ? "Paid" : "Overdue";
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className={`w-fit ${map[status]}`}>{label}</Badge>
      {balance > 0 && (
        <span className="text-xs text-muted-foreground">{formatFCFA(balance)} due</span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: StudentStatus }) {
  const map: Record<StudentStatus, string> = {
    active: "bg-primary/10 text-primary border-primary/20",
    inactive: "bg-muted text-muted-foreground border-border",
    suspended: "bg-destructive/10 text-destructive border-destructive/30",
    withdrawn: "bg-muted text-muted-foreground border-border",
    graduated: "bg-secondary text-secondary-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`capitalize ${map[status]}`}>
      {status}
    </Badge>
  );
}
