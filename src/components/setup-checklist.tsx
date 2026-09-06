import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, GraduationCap, Settings2, Users, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOnboardingStatus } from "@/lib/onboarding.functions";

const HIDDEN_KEY = "schoolflow.setup-checklist.hidden.v1";

type Step = {
  id: "school" | "team" | "classes" | "students" | "finance";
  title: string;
  description: string;
  to: string;
  icon: typeof Settings2;
};

const steps: Step[] = [
  {
    id: "school",
    title: "Complete your school profile",
    description: "Add your school name, code, location and academic year.",
    to: "/settings",
    icon: Settings2,
  },
  {
    id: "team",
    title: "Invite your team",
    description: "Invite principals, bursars, teachers, reception and other staff.",
    to: "/settings/users",
    icon: Users,
  },
  {
    id: "classes",
    title: "Set up your classes",
    description: "Create the classes and academic structure your school uses.",
    to: "/classes/manage",
    icon: GraduationCap,
  },
  {
    id: "students",
    title: "Add your first students",
    description: "Start with admissions or add your existing student records.",
    to: "/admissions/new",
    icon: Users,
  },
  {
    id: "finance",
    title: "Set up fees",
    description: "Create fee assignments before recording payments and balances.",
    to: "/finance",
    icon: WalletCards,
  },
];

export function SetupChecklist() {
  const fetchStatus = useServerFn(getOnboardingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => fetchStatus(),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const hidden = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(HIDDEN_KEY) === "1";
  }, []);

  if (isLoading || !data || hidden) return null;

  const completed = steps.filter((step) => data[step.id].complete).map((step) => step.id);
  const progress = Math.round((completed.length / steps.length) * 100);
  const nextStep = steps.find((step) => !data[step.id].complete);

  if (!nextStep) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Get your school ready</CardTitle>
              <Badge variant="secondary">{progress}% complete</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              SchoolFlow automatically tracks your setup. Complete each step and it will check itself off.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.setItem(HIDDEN_KEY, "1");
              window.location.reload();
            }}
          >
            Hide for now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, index) => {
          const status = data[step.id];
          const done = status.complete;
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition ${done ? "bg-muted/40" : "bg-card"}`}
            >
              {done ? (
                <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
              )}
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{done ? status.detail : step.description}</p>
              </div>
              {!done && (
                <Button size="sm" variant={nextStep.id === step.id ? "default" : "outline"} asChild>
                  <Link to={step.to}>
                    {nextStep.id === step.id ? "Start" : "Open"}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
