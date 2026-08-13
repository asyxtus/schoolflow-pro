import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listStaffAttendance,
  upsertStaffAttendance,
  type StaffAttStatus,
} from "@/lib/staff-attendance.functions";

export const Route = createFileRoute("/_authenticated/staff-attendance")({
  component: StaffAttendancePage,
});

const STATUS: { v: StaffAttStatus; label: string; cls: string }[] = [
  { v: "present", label: "P", cls: "bg-emerald-600 text-white" },
  { v: "late", label: "L", cls: "bg-amber-500 text-white" },
  { v: "absent", label: "A", cls: "bg-red-600 text-white" },
  { v: "leave", label: "LV", cls: "bg-indigo-500 text-white" },
  { v: "sick", label: "S", cls: "bg-slate-500 text-white" },
];

function StaffAttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const listFn = useServerFn(listStaffAttendance);
  const upsertFn = useServerFn(upsertStaffAttendance);
  const q = useQuery({ queryKey: ["staff-att", date], queryFn: () => listFn({ data: { date } }) });

  const mark = useMutation({
    mutationFn: (v: { staff_id: string; status: StaffAttStatus }) =>
      upsertFn({ data: { staff_id: v.staff_id, work_date: date, status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-att", date] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 py-6 space-y-5">
      <PageHeader
        title="Staff attendance"
        description="Daily clock-in register — only HR managers can record."
      />
      <div className="flex items-end gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !q.data?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No active staff.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {q.data.map((s) => {
            const cur = s.attendance?.status as StaffAttStatus | undefined;
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">
                      {s.first_name} {s.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.position}
                      {s.matricule ? ` · ${s.matricule}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {STATUS.map((st) => (
                      <Button
                        key={st.v}
                        size="sm"
                        className={`h-9 w-9 p-0 font-semibold ${cur === st.v ? st.cls : "bg-muted text-foreground hover:bg-muted/70"}`}
                        onClick={() => mark.mutate({ staff_id: s.id, status: st.v })}
                      >
                        {st.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Legend: P = Present · L = Late · A = Absent · LV = Leave · S = Sick
      </div>
    </div>
  );
}
