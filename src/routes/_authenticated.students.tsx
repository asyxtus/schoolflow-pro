import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import {
  CLASS_OPTIONS,
  STUDENTS,
  formatFCFA,
  type FeeStatus,
  type Student,
  type StudentStatus,
} from "@/lib/mock/students";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  class: z.string().optional().default("all"),
  fees: z.enum(["all", "paid", "partial", "overdue"]).optional().default("all"),
  status: z.enum(["all", "active", "suspended", "withdrawn", "graduated"]).optional().default("all"),
});

export const Route = createFileRoute("/_app/students")({
  validateSearch: searchSchema,
  component: StudentsPage,
});

function StudentsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/students" });

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return STUDENTS.filter((s) => {
      if (search.class !== "all" && s.className !== search.class) return false;
      if (search.fees !== "all" && s.feeStatus !== search.fees) return false;
      if (search.status !== "all" && s.status !== search.status) return false;
      if (!q) return true;
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.matricule.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q)
      );
    });
  }, [search]);

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Students"
        description={`${STUDENTS.length} enrolled learners across ${new Set(STUDENTS.map((s) => s.className)).size} classes`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" /> Add student
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
              {CLASS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "All classes" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={search.fees} onValueChange={(v) => setSearch({ fees: v as typeof search.fees })}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Fees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fees</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={search.status} onValueChange={(v) => setSearch({ status: v as typeof search.status })}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
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
                <StudentRow key={s.id} student={s} />
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
            <span className="font-medium text-foreground">{STUDENTS.length}</span> students
          </span>
          <Button variant="ghost" size="sm" className="text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> Load more
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StudentRow({ student }: { student: Student }) {
  const initials = (student.firstName[0] ?? "") + (student.lastName[0] ?? "");
  return (
    <TableRow className="group">
      <TableCell>
        <Link
          to="/students/$studentId"
          params={{ studentId: student.id }}
          className="flex items-center gap-3"
        >
          <span className="w-1 self-stretch rounded-full bg-primary/70 opacity-0 transition group-hover:opacity-100" />
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground group-hover:text-primary">
              {student.lastName} {student.firstName}
            </div>
            <div className="text-xs text-muted-foreground">
              {student.gender === "M" ? "Male" : "Female"} · Born {student.dateOfBirth}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs">{student.matricule}</TableCell>
      <TableCell>
        <div className="text-sm text-foreground">{student.className}</div>
        <div className="text-xs text-muted-foreground">{student.formMaster}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-foreground">{student.guardianName}</div>
        <div className="text-xs text-muted-foreground">{student.guardianPhone}</div>
      </TableCell>
      <TableCell>
        <AttendanceBadge rate={student.attendanceRate} />
      </TableCell>
      <TableCell>
        <FeePill status={student.feeStatus} balance={student.feeBalance} />
      </TableCell>
      <TableCell>
        <StatusPill status={student.status} />
      </TableCell>
    </TableRow>
  );
}

function AttendanceBadge({ rate }: { rate: number }) {
  const tone =
    rate >= 95
      ? "text-primary"
      : rate >= 85
        ? "text-foreground"
        : "text-destructive";
  return <span className={`text-sm font-medium ${tone}`}>{rate}%</span>;
}

function FeePill({ status, balance }: { status: FeeStatus; balance: number }) {
  const map: Record<FeeStatus, string> = {
    paid: "bg-primary/10 text-primary border-primary/20",
    partial: "bg-accent/20 text-accent-foreground border-accent/40",
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const label = status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Overdue";
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