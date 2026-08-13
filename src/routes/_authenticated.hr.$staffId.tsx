import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { getStaff, upsertAllowance, deleteAllowance } from "@/lib/hr.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

const qo = (id: string) =>
  queryOptions({ queryKey: ["hr", "staff", id], queryFn: () => getStaff({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/hr/$staffId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qo(params.staffId)),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: StaffProfile,
});

function StaffProfile() {
  const { staffId } = Route.useParams();
  const { data } = useSuspenseQuery(qo(staffId));
  const router = useRouter();
  const save = useServerFn(upsertAllowance);
  const del = useServerFn(deleteAllowance);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"allowance" | "deduction">("allowance");
  const [amt, setAmt] = useState(0);

  if (!data?.staff)
    return (
      <div className="p-6">
        Staff not found.{" "}
        <Link to="/hr" className="underline">
          Back
        </Link>
      </div>
    );
  const s = data.staff;
  const gross =
    (s.base_salary_fcfa ?? 0) +
    data.allowances
      .filter((a) => a.kind === "allowance" && a.active)
      .reduce((x, a) => x + a.amount_fcfa, 0);
  const ded = data.allowances
    .filter((a) => a.kind === "deduction" && a.active)
    .reduce((x, a) => x + a.amount_fcfa, 0);

  async function add() {
    if (!label || amt <= 0) {
      toast.error("Label and amount required");
      return;
    }
    try {
      await save({ data: { staff_id: staffId, label, kind, amount_fcfa: amt, active: true } });
      setLabel("");
      setAmt(0);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function remove(id: string) {
    await del({ data: { id } });
    router.invalidate();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Button asChild variant="ghost" size="sm">
        <Link to="/hr">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to staff
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-semibold">
          {s.first_name} {s.last_name}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">
          {s.position.replace("_", " ")} · {s.department ?? "—"} ·{" "}
          <Badge variant="outline" className="capitalize">
            {s.status.replace("_", " ")}
          </Badge>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Base salary" value={fmt(s.base_salary_fcfa ?? 0)} />
        <Stat label="Total allowances" value={fmt(gross - (s.base_salary_fcfa ?? 0))} />
        <Stat label="Total deductions" value={fmt(ded)} />
        <Stat label="Estimated net" value={fmt(Math.max(gross - ded, 0))} accent />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allowances &amp; Deductions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_140px_160px_auto]">
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Housing"
              />
            </div>
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "allowance" | "deduction")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowance">Allowance</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (FCFA)</Label>
              <Input
                type="number"
                value={amt}
                onChange={(e) => setAmt(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={add}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Label</th>
                <th>Kind</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.allowances.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.label}</td>
                  <td className="capitalize">
                    <Badge variant={a.kind === "deduction" ? "destructive" : "secondary"}>
                      {a.kind}
                    </Badge>
                  </td>
                  <td className="text-right font-mono">{fmt(a.amount_fcfa)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!data.allowances.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No recurring items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <Info k="Phone" v={s.phone} />
          <Info k="Email" v={s.email} />
          <Info k="Address" v={s.address} />
          <Info k="National ID" v={s.national_id} />
          <Info k="Bank" v={s.bank_name} />
          <Info k="Bank account" v={s.bank_account} />
          <Info k="MoMo" v={s.momo_number} />
          <Info k="Hire date" v={s.hire_date} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div>{v || "—"}</div>
    </div>
  );
}
