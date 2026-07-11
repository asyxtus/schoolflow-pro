import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { FilePlus2, MoreHorizontal, UserRoundPlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APPLICANTS, STAGES, type Applicant } from "@/lib/mock/admissions";

export const Route = createFileRoute("/_authenticated/admissions")({
  component: AdmissionsPage,
});

function AdmissionsPage() {
  const matchRoute = useMatchRoute();
  const showChild = matchRoute({ to: "/admissions/new" });

  if (showChild) return <Outlet />;

  const total = APPLICANTS.length;
  const enrolled = APPLICANTS.filter((a) => a.stage === "enrolled").length;

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
          const cards = APPLICANTS.filter((a) => a.stage === stage.id);
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

function ApplicantCard({ applicant }: { applicant: Applicant }) {
  return (
    <Card className="group cursor-pointer border-border/70 p-3 shadow-none transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {applicant.fullName}
          </div>
          <div className="text-xs text-muted-foreground">{applicant.desiredClass}</div>
        </div>
        {applicant.score !== undefined && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            {applicant.score}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="truncate">{applicant.previousSchool}</span>
        <span>Submitted {applicant.submittedOn}</span>
      </div>
      {applicant.notes && (
        <div className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-foreground/80">
          {applicant.notes}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <span className="text-muted-foreground">{applicant.guardianPhone}</span>
        <FilePlus2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
    </Card>
  );
}