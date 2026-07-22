import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, MessageCircle, Phone, Search, Download, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listFeesAging, type AgingBucket } from "@/lib/aging.functions";
import { getCurrentSchool } from "@/lib/school.functions";
import { useClassOptions } from "@/hooks/use-classes";

export const Route = createFileRoute("/_authenticated/finance/aging")({
  component: AgingPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1_7": "1–7 days",
  "8_30": "8–30 days",
  "31_60": "31–60 days",
  "60_plus": "60+ days",
};

const BUCKET_TONE: Record<AgingBucket, string> = {
  current: "bg-muted text-muted-foreground",
  "1_7": "bg-amber-100 text-amber-900",
  "8_30": "bg-orange-100 text-orange-900",
  "31_60": "bg-red-100 text-red-900",
  "60_plus": "bg-destructive text-destructive-foreground",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  // Cameroon: prepend 237 if missing (numbers are 9 digits locally)
  if (digits.startsWith("237")) return digits;
  if (digits.length === 9) return "237" + digits;
  return digits;
}

function buildMessage(opts: {
  guardian: string | null;
  studentFirst: string;
  studentLast: string;
  className: string | null;
  balance: number;
  daysOverdue: number;
  schoolName: string;
}) {
  const salutation = opts.guardian ? `Bonjour ${opts.guardian}` : "Bonjour";
  const student = `${opts.studentFirst} ${opts.studentLast}${opts.className ? ` (${opts.className})` : ""}`;
  const overdue = opts.daysOverdue > 0 ? ` en retard de ${opts.daysOverdue} jour(s)` : "";
  return [
    `${salutation},`,
    ``,
    `${opts.schoolName} vous informe que la scolarité de ${student} présente un solde impayé de ${fmt(opts.balance)}${overdue}.`,
    ``,
    `Merci de bien vouloir régulariser dans les meilleurs délais. Pour toute question, n'hésitez pas à contacter le secrétariat.`,
    ``,
    `Cordialement,`,
    `${opts.schoolName}`,
  ].join("\n");
}

function AgingPage() {
  const agingFn = useServerFn(listFeesAging);
  const schoolFn = useServerFn(getCurrentSchool);
  const classesQ = useClassOptions();

  const [q, setQ] = useState("");
  const [className, setClassName] = useState<string>("all");
  const [bucket, setBucket] = useState<AgingBucket | "all">("all");

  const args = useMemo(
    () => ({
      q: q || undefined,
      className: className === "all" ? undefined : className,
      bucket: bucket === "all" ? undefined : bucket,
    }),
    [q, className, bucket],
  );

  const agingQ = useQuery({
    queryKey: ["fees-aging", args],
    queryFn: () => agingFn({ data: args }),
  });
  const schoolQ = useQuery({ queryKey: ["current-school"], queryFn: () => schoolFn() });
  const schoolName = schoolQ.data?.school?.name ?? "L'école";

  const totals = agingQ.data?.totals;
  const rows = agingQ.data?.rows ?? [];

  const exportCsv = () => {
    const header = ["Matricule", "Élève", "Classe", "Tuteur", "Téléphone", "Solde FCFA", "Jours de retard", "Tranche"];
    const lines = rows.map((r) => [
      r.matricule ?? "", `${r.first_name} ${r.last_name}`, r.class_name ?? "",
      r.guardian_name ?? "", r.guardian_phone ?? "", String(r.fee_balance), String(r.days_overdue),
      BUCKET_LABELS[r.bucket],
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fees-aging-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees aging & reminders"
        description="Chase outstanding tuition. Send WhatsApp reminders to guardians in one tap."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/finance"><ArrowLeft className="mr-1 h-4 w-4" />Finance</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" />Export CSV
            </Button>
          </div>
        }
      />

      {/* Bucket summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["current", "1_7", "8_30", "31_60", "60_plus"] as AgingBucket[]).map((b) => (
          <button
            key={b}
            onClick={() => setBucket(bucket === b ? "all" : b)}
            className={`rounded-lg border p-3 text-left transition ${bucket === b ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
          >
            <div className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${BUCKET_TONE[b]}`}>
              {BUCKET_LABELS[b]}
            </div>
            <p className="mt-2 text-lg font-semibold">{fmt(totals?.[b] ?? 0)}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, matricule, guardian…" className="pl-9" />
          </div>
          <Select value={className} onValueChange={setClassName}>
            <SelectTrigger className="md:w-[220px]"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(classesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Total outstanding: <strong className="text-foreground">{fmt(totals?.total ?? 0)}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Rows */}
      <Card>
        <CardContent className="p-0">
          {agingQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No outstanding balances match your filter. 🎉</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const phone = normalizePhone(r.guardian_phone ?? "");
                const msg = buildMessage({
                  guardian: r.guardian_name,
                  studentFirst: r.first_name,
                  studentLast: r.last_name,
                  className: r.class_name,
                  balance: r.fee_balance,
                  daysOverdue: r.days_overdue,
                  schoolName,
                });
                const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : "";
                const tel = phone ? `tel:+${phone}` : "";
                return (
                  <li key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.first_name} {r.last_name}</p>
                        {r.matricule && <Badge variant="outline">{r.matricule}</Badge>}
                        {r.class_name && <Badge variant="secondary">{r.class_name}</Badge>}
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${BUCKET_TONE[r.bucket]}`}>
                          {BUCKET_LABELS[r.bucket]}
                          {r.days_overdue > 0 ? ` · ${r.days_overdue}d` : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.guardian_name ? `${r.guardian_name}${r.guardian_relationship ? ` (${r.guardian_relationship})` : ""}` : "No guardian on file"}
                        {r.guardian_phone ? ` · ${r.guardian_phone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:flex-col md:items-end">
                      <p className="text-lg font-semibold text-destructive md:text-right">{fmt(r.fee_balance)}</p>
                      <div className="flex flex-wrap gap-2">
                        {phone ? (
                          <>
                            <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#20b358]">
                              <a href={wa} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-1 h-4 w-4" />WhatsApp
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <a href={tel}><Phone className="mr-1 h-4 w-4" />Call</a>
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Add guardian phone</Badge>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/students/$studentId" params={{ studentId: r.id }}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}