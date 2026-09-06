import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, CircleCheck, GraduationCap, Settings2, Users, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_KEY = "schoolflow.setup-checklist.v1";

type Step = {
  id: string;
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
    id: "admissions",
    title: "Add your first students",
    description: "Start with admissions or add your existing student records.",
    to: "/admissions/new",
    icon: Users,
  },
  {
    id: "finance",
    title: "Set up fees",
    description: "Create fee structures before recording payments and balances.",
    to: "/finance",
    icon: WalletCards,
  },
];

export function SetupChecklist() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved)) setCompleted(saved);
      if (saved === "hidden") setHidden(true);
    } catch {
      // Ignore malformed local storage and show the checklist.
    }
  }, []);

  const toggle = (id: string) => {
    setCompleted((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const progress = Math.round((completed.length / steps.length) * 100);
  const nextStep = steps.find((step) => !completed.includes(step.id));

  if (hidden || completed.length === steps.length) return null;

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
              Follow these steps once and SchoolFlow will be ready for day-to-day operations.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, "hidden");
              setHidden(true);
            }}
          >
            Skip for now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, index) => {
          const done = completed.includes(step.id);
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                done ? "bg-muted/40" : "bg-card"
              }`}
            >
              <button
                type="button"
                aria-label={done ? `Mark step ${index + 1} incomplete` : `Mark step ${index + 1} complete`}
                onClick={() => toggle(step.id)}
                className="shrink-0 rounded-full"
              >
                {done ? (
                  <CircleCheck className="h-5 w-5 text-primary" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </button>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!done && (
                <Button size="sm" variant={nextStep?.id === step.id ? "default" : "outline"} asChild>
                  <Link to={step.to}>
                    {nextStep?.id === step.id ? "Start" : "Open"}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {done && <Check className="h-4 w-4 text-primary" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
