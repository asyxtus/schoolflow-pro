import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Users, TrendingUp, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClasses } from "@/lib/classes.functions";

const classesQuery = queryOptions({
  queryKey: ["classes"],
  queryFn: () => getClasses(),
});

export const Route = createFileRoute("/_authenticated/classes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  component: ClassesPage,
});

function fmtFcfa(n: number) {
  return (
    new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\u202f|\u00a0/g, " ") + " FCFA"
  );
}

function ClassesPage() {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const totalStudents = classes.reduce((s, c) => s + c.total, 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Classes"
        description={`${classes.length} class${classes.length === 1 ? "" : "es"} · ${totalStudents} learner${totalStudents === 1 ? "" : "s"}`}
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/classes/manage">Manage classes & subjects</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/students/new">Add student</Link>
            </Button>
          </div>
        }
      />

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No classes yet. Add a student and assign them to a class to see it here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.className} className="relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
              <CardContent className="space-y-4 p-5 pl-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{c.className}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.sections.length
                        ? `Sections ${c.sections.join(", ")}`
                        : "No sections defined"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {c.active}/{c.total} active
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Stat
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Learners"
                    value={String(c.total)}
                  />
                  <Stat
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    label="Attend."
                    value={`${c.avgAttendance}%`}
                  />
                  <Stat
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label="Owed"
                    value={fmtFcfa(c.outstanding)}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    M {c.male} · F {c.female}
                  </span>
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <Link
                      to="/students"
                      search={{ q: "", class: c.className, fees: "all", status: "all" }}
                    >
                      View roster →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}
