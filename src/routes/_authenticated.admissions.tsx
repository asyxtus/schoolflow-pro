import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FilePlus2, MoreHorizontal, UserRoundPlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApplicants } from "@/lib/admissions.functions";
import type { Tables } from "@/integrations/supabase/types";

const applicantsQueryOptions = () => ({
  queryKey: ["applicants"] as const,
  queryFn: () => getApplicants(),
});

export const Route = createFileRoute("/_authenticated/admissions")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(applicantsQueryOptions());
  },
  component: AdmissionsPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Couldn't load applicants</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

const STAGES: { id: Tables<"applicants">["stage"]; label: string; tone: string }[] = [
  { id: "new", label: "New enquiry", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { id: "review", label: "Under review", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { id: "interview", label: "Interview", tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { id: "offer", label: "Offer sent", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { id: "enrolled", label: "Enrolled", tone: "bg-primary/20 text-primary" },
  { id: "rejected", label: "Rejected", tone: "bg-destructive/10 text-destructive" },
];

function AdmissionsPage() {
  const matchRoute = useMatchRoute();
  const showChild = matchRoute({ to: "/admissions/new" });
  const { data: applicants } = useSuspenseQuery(applicantsQueryOptions());

  if (showChild) return <Outlet />;

  const total = (applicants ?? []).length;
  const enrolled = (applicants ?? []).filter((a) => a.stage === "enrolled").length;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
      <PageHeader
        title="Admissions"
        description={`${total} applicants this intake · ${enrolled} enrolled`}
        actions={
          <Button asChild size="sm">
            <Link to="/admissions/new">
              <UserRoundPlus className="mr-2 h-4 w-4" /> New application
            </Link>
          </Button>
        }
      />

      <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const cards = (applicants ?? []).filter((a) => a.stage === stage.id);
          return (
            <div key={stage.id} className="flex min-w-72 flex-col">
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${stage.tone}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/30 p-2 min-h-32">
                {cards.map((a) => <ApplicantCard key={a.id} applicant={a} />)}
                {cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border py-6 text-xs text-muted-foreground">
                    Nothing here yet
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicantCard({ applicant }: { applicant: Tables<"applicants"> }) {
  const fullName = `${applicant.last_name} ${applicant.first_name}`;
  return (
    <Card className="group cursor-pointer border-border/70 p-3 shadow-none transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {fullName}
          </div>
          <div className="text-xs text-muted-foreground">{applicant.class_applied_for}</div>
        </div>
        {applicant.score !== undefined && applicant.score !== null && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            {applicant.score}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="truncate">{applicant.prior_school ?? "—"}</span>
        <span>Submitted {applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleDateString() : "—"}</span>
      </div>
      {applicant.notes && (
        <div className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-foreground/80">
          {applicant.notes}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <span className="text-muted-foreground">{applicant.guardian_phone ?? "—"}</span>
        <FilePlus2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
    </Card>
  );
}
