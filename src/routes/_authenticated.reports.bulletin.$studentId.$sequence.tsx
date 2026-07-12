import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { computeBulletin, upsertBulletinMeta } from "@/lib/reports.functions";

export const Route = createFileRoute(
  "/_authenticated/reports/bulletin/$studentId/$sequence",
)({
  component: BulletinPage,
});

const nf = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

function BulletinPage() {
  const { studentId, sequence } = Route.useParams();
  const seq = Number(sequence);
  const qc = useQueryClient();

  const fetchBulletin = useServerFn(computeBulletin);
  const saveMeta = useServerFn(upsertBulletinMeta);

  const q = useQuery({
    queryKey: ["bulletin", studentId, seq],
    queryFn: () => fetchBulletin({ data: { studentId, sequence: seq } }),
  });

  const meta = q.data?.meta;
  const [conduct, setConduct] = useState("");
  const [absJ, setAbsJ] = useState(0);
  const [absU, setAbsU] = useState(0);
  const [headRemark, setHeadRemark] = useState("");
  const [principalRemark, setPrincipalRemark] = useState("");

  useEffect(() => {
    if (!meta) return;
    setConduct(meta.conduct ?? "");
    setAbsJ(meta.absences_justified ?? 0);
    setAbsU(meta.absences_unjustified ?? 0);
    setHeadRemark(meta.head_teacher_remark ?? "");
    setPrincipalRemark(meta.principal_remark ?? "");
  }, [meta]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveMeta({
        data: {
          studentId,
          sequence: seq,
          conduct,
          absences_justified: Number(absJ) || 0,
          absences_unjustified: Number(absU) || 0,
          head_teacher_remark: headRemark,
          principal_remark: principalRemark,
        },
      }),
    onSuccess: () => {
      toast.success("Remarks saved");
      qc.invalidateQueries({ queryKey: ["bulletin", studentId, seq] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = q.data?.totals;
  const rows = q.data?.rows ?? [];
  const student = q.data?.student;
  const school = q.data?.school;

  const strongest = useMemo(
    () => rows.filter((r) => r.mark != null).sort((a, b) => (b.mark ?? 0) - (a.mark ?? 0))[0],
    [rows],
  );
  const weakest = useMemo(
    () => rows.filter((r) => r.mark != null).sort((a, b) => (a.mark ?? 0) - (b.mark ?? 0))[0],
    [rows],
  );

  if (q.isLoading || !q.data) {
    return <div className="p-10 text-center text-muted-foreground">Loading bulletin…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6 print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
        </Button>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-2 h-4 w-4" />Save remarks
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>
      </div>

      {/* Bulletin */}
      <div className="rounded-lg border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none">
        {/* Header */}
        <div className="border-b-2 border-primary pb-4 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            République du Cameroun — Republic of Cameroon
          </div>
          <h1 className="mt-1 text-2xl font-bold">{school?.name}</h1>
          <div className="text-sm text-muted-foreground">
            {[school?.city, school?.region].filter(Boolean).join(", ")}
            {school?.code ? ` · ${school.code}` : ""}
          </div>
          {school?.motto ? (
            <div className="mt-1 text-xs italic text-muted-foreground">"{school.motto}"</div>
          ) : null}
          <div className="mt-3 text-lg font-semibold uppercase tracking-wide">
            Report Card — Sequence {seq}
          </div>
        </div>

        {/* Student info */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Info label="Name" value={`${student?.last_name ?? ""} ${student?.first_name ?? ""}`.trim()} />
          <Info label="Matricule" value={student?.matricule ?? "—"} />
          <Info label="Class" value={student?.class_name ?? "—"} />
          <Info label="Section" value={student?.section ?? "—"} />
          <Info label="Gender" value={student?.gender ?? "—"} />
          <Info label="Date of birth" value={student?.date_of_birth ?? "—"} />
          <Info label="Class size" value={String(totals?.classSize ?? 0)} />
          <Info label="Sequence" value={String(seq)} />
        </div>

        {/* Grades table */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="border p-2">Subject</th>
              <th className="border p-2 w-14 text-center">Coef</th>
              <th className="border p-2 w-20 text-center">Mark /20</th>
              <th className="border p-2 w-20 text-center">Weighted</th>
              <th className="border p-2 w-20 text-center">Rank</th>
              <th className="border p-2 w-24 text-center">Class avg</th>
              <th className="border p-2">Teacher</th>
              <th className="border p-2">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // grades stored on /100 in this project — convert to /20 for bulletin
              const mark20 = r.mark != null ? r.mark / 5 : null;
              const classAvg20 = r.classAvg != null ? r.classAvg / 5 : null;
              const weighted = mark20 != null ? mark20 * r.coef : null;
              return (
                <tr key={r.subject}>
                  <td className="border p-2 font-medium">{r.subject}</td>
                  <td className="border p-2 text-center">{r.coef}</td>
                  <td className="border p-2 text-center">{nf(mark20)}</td>
                  <td className="border p-2 text-center">{nf(weighted)}</td>
                  <td className="border p-2 text-center">{r.rank ?? "—"}</td>
                  <td className="border p-2 text-center">{nf(classAvg20)}</td>
                  <td className="border p-2 text-xs">{r.teacher ?? "—"}</td>
                  <td className="border p-2 text-xs">{r.remark ?? ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="border p-6 text-center text-muted-foreground">
                  No grades recorded for this sequence.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td className="border p-2 text-right" colSpan={3}>Totals</td>
              <td className="border p-2 text-center">
                {nf(totals ? totals.totalWeighted / 5 : null)}
              </td>
              <td className="border p-2 text-center" colSpan={4}>
                over {nf(totals?.totalCoef ?? 0, 0)} coef
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Summary */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Summary label="Overall average" value={`${nf(totals?.overallAvg ? totals.overallAvg / 5 : null)} / 20`} />
          <Summary label="Class average" value={`${nf(totals?.classAvgOverall ? totals.classAvgOverall / 5 : null)} / 20`} />
          <Summary label="Rank" value={totals?.overallRank ? `${totals.overallRank} / ${totals.classSize}` : "—"} />
          <Summary label="Appreciation" value={totals?.appreciation ?? "—"} />
        </div>

        {/* Discipline + remarks (editable, but print-friendly) */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Discipline</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Conduct</span>
                <Input value={conduct} onChange={(e) => setConduct(e.target.value)} className="h-8 print:border-0 print:p-0 print:shadow-none" />
              </label>
              <div />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Absences (justified)</span>
                <Input type="number" value={absJ} onChange={(e) => setAbsJ(Number(e.target.value))} className="h-8 print:border-0 print:p-0 print:shadow-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Absences (unjustified)</span>
                <Input type="number" value={absU} onChange={(e) => setAbsU(Number(e.target.value))} className="h-8 print:border-0 print:p-0 print:shadow-none" />
              </label>
            </div>
          </div>
          <div className="rounded border p-3 text-sm">
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Highlights</div>
            <div>Strongest subject: <b>{strongest?.subject ?? "—"}</b> {strongest?.mark != null ? `(${nf(strongest.mark / 5)}/20)` : ""}</div>
            <div>Weakest subject: <b>{weakest?.subject ?? "—"}</b> {weakest?.mark != null ? `(${nf(weakest.mark / 5)}/20)` : ""}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 rounded border p-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Head Teacher's Remark</span>
            <Textarea value={headRemark} onChange={(e) => setHeadRemark(e.target.value)} rows={3} className="print:border-0 print:p-0 print:shadow-none" />
          </label>
          <label className="flex flex-col gap-1 rounded border p-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Principal's Remark</span>
            <Textarea value={principalRemark} onChange={(e) => setPrincipalRemark(e.target.value)} rows={3} className="print:border-0 print:p-0 print:shadow-none" />
          </label>
        </div>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-center text-xs">
          <SigLine label="Head Teacher" />
          <SigLine label="Principal" />
          <SigLine label="Parent / Guardian" />
        </div>

        <div className="mt-6 text-center text-[10px] text-muted-foreground print:mt-4">
          Issued on {new Date().toLocaleDateString()} · SchoolERP Cameroon
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          nav, aside, header, [data-sidebar] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function SigLine({ label }: { label: string }) {
  return (
    <div>
      <div className="mt-6 border-t border-black/60" />
      <div className="mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}