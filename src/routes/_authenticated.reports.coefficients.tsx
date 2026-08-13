import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Settings } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { listClassNames } from "@/lib/attendance.functions";
import { listCoefficients } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/reports/coefficients")({
  component: CoefficientsPage,
});

function CoefficientsPage() {
  const [className, setClassName] = useState("");

  const listClasses = useServerFn(listClassNames);
  const fetchList = useServerFn(listCoefficients);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => listClasses() });
  const listQ = useQuery({
    queryKey: ["coefficients", className],
    queryFn: () => fetchList({ data: { className } }),
    enabled: !!className,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Subject Coefficients"
        description="What the bulletin engine uses to weight each subject — set in Classes → Manage."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/classes/manage">
              <Settings className="mr-2 h-4 w-4" />
              Edit in Classes
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Select a class to see its subject coefficients.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="w-24 text-center">Coefficient</TableHead>
                <TableHead>Teacher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(listQ.data?.coefficients ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject}</TableCell>
                  <TableCell className="text-center">{c.coefficient}</TableCell>
                  <TableCell>{c.teacher_name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(listQ.data?.coefficients ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                    No subjects configured for this class yet —{" "}
                    <Link to="/classes/manage" className="underline">
                      set them up in Classes → Manage
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
