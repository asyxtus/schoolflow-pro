import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles, Settings2, Users, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getOnboardingStatus, type OnboardingRole, type OnboardingStatus } from "@/lib/onboarding.functions";

const HIDDEN_KEY = "schoolflow.setup-checklist.hidden.v2";
type StepId = "school" | "team" | "classes" | "students" | "finance";
type Step = { id: StepId; title: string; description: string; to: string; icon: typeof Settings2 };

const steps: Step[] = [
  { id: "school", title: "Complete your school profile", description: "Add your school name, code, location and academic year.", to: "/settings", icon: Settings2 },
  { id: "team", title: "Invite your team", description: "Invite the people who will help run your school.", to: "/settings/users", icon: Users },
  { id: "classes", title: "Set up your classes", description: "Create the classes your school uses for this academic year.", to: "/classes/manage", icon: GraduationCap },
  { id: "students", title: "Add your students", description: "Start with admissions or add your existing student records.", to: "/students/new", icon: Users },
  { id: "finance", title: "Set up fees", description: "Create your fee assignments before recording payments.", to: "/finance", icon: WalletCards },
];

const roleOrder: Record<OnboardingRole, StepId[]> = {
  super_admin: ["school", "team", "classes", "students", "finance"],
  diocese_admin: ["team", "school", "classes", "students", "finance"],
  principal: ["school", "team", "classes", "students", "finance"],
  vice_principal: ["classes", "students", "team", "school", "finance"],
  bursar: ["finance", "students", "school", "team", "classes"],
  teacher: ["classes", "students", "school", "team", "finance"],
  secretary: ["students", "team", "school", "classes", "finance"],
  receptionist: ["students", "team", "school", "classes", "finance"],
  dean_of_studies: ["classes", "students", "school", "team", "finance"],
  discipline_master: ["students", "classes", "team", "school", "finance"],
  boarding_master: ["students", "classes", "team", "school", "finance"],
  sports_master: ["students", "classes", "team", "school", "finance"],
  nurse: ["students", "school", "team", "classes", "finance"],
  counsellor: ["students", "school", "team", "classes", "finance"],
  parent: ["students", "school", "team", "classes", "finance"],
  student: ["classes", "school", "students", "team", "finance"],
};

const roleIntro: Record<OnboardingRole, string> = {
  super_admin: "We'll help you establish the school structure and get the team running.",
  diocese_admin: "We'll prioritize the people and school structure you need to manage.",
  principal: "We'll prioritize the essentials you need to run your school.",
  vice_principal: "We'll get your academic and student operations ready first.",
  bursar: "We'll prioritize fees and student finance so you can start collecting payments.",
  teacher: "We'll prioritize classes and students so you can start teaching.",
  secretary: "We'll prioritize student records and administration.",
  receptionist: "We'll prioritize student records and front-desk operations.",
  dean_of_studies: "We'll prioritize classes and academic records.",
  discipline_master: "We'll prioritize students and the structure you'll manage.",
  boarding_master: "We'll prioritize students and the structure needed for boarding operations.",
  sports_master: "We'll prioritize students and the structure needed for sports operations.",
  nurse: "We'll prioritize student records so health and clinic work can start smoothly.",
  counsellor: "We'll prioritize student records so pastoral support can start smoothly.",
  parent: "Your school administrator is setting up the school. We'll show you what matters for your account.",
  student: "We'll prioritize the academic information you need to use SchoolFlow.",
};

function actionFor(step: Step, count?: number) {
  if (step.id === "team") return count === 1 ? "Invite your first team member" : "Invite your team";
  if (step.id === "school") return "Add school details";
  if (step.id === "classes") return "Create your first class";
  if (step.id === "students") return "Add your first student";
  return "Configure your first fee";
}

function orderedSteps(data: OnboardingStatus) {
  const order = roleOrder[data.role] ?? roleOrder.principal;
  return [...steps].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function SetupChecklist() {
  const fetchStatus = useServerFn(getOnboardingStatus);
  const { data, isLoading } = useQuery({ queryKey: ["onboarding-status"], queryFn: () => fetchStatus(), staleTime: 15_000, refetchInterval: 30_000 });
  const hidden = useMemo(() => typeof window !== "undefined" && localStorage.getItem(HIDDEN_KEY) === "1", []);
  if (isLoading || !data || hidden) return null;

  const visibleSteps = orderedSteps(data);
  const completed = visibleSteps.filter((s) => data[s.id].complete).length;
  const progress = Math.round((completed / visibleSteps.length) * 100);
  const next = visibleSteps.find((s) => !data[s.id].complete);

  if (!next) return (
    <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-full bg-primary/10 p-2 text-primary"><CheckCircle2 className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1"><p className="font-semibold">Your school is ready 🎉</p><p className="text-sm text-muted-foreground">The essential SchoolFlow setup is complete. You can now run your day-to-day operations.</p></div>
        <Badge variant="secondary">100%</Badge>
      </CardContent>
    </Card>
  );

  const nextStatus = data[next.id];
  return (
    <Card className="mb-6 overflow-hidden border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><div className="rounded-md bg-primary/10 p-1.5 text-primary"><Sparkles className="h-4 w-4" /></div><CardTitle className="text-base">Let’s get your school ready</CardTitle><Badge variant="secondary">{progress}%</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{roleIntro[data.role]}</p>
            <p className="mt-1 text-xs text-muted-foreground">Your setup guide is personalized for your role: <span className="font-medium text-foreground">{data.roleLabel}</span>.</p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { localStorage.setItem(HIDDEN_KEY, "1"); window.location.reload(); }}>Remind me later</Button>
        </div>
        <Progress value={progress} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{(() => { const Icon = next.icon; return <Icon className="h-5 w-5" />; })()}</div>
            <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-wide text-primary">Recommended next for you</p><p className="mt-0.5 font-semibold">{actionFor(next, nextStatus.count)}</p><p className="mt-0.5 text-sm text-muted-foreground">{nextStatus.detail || next.description}</p></div>
            <Button size="sm" asChild><Link to={next.to}>Continue setup<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {visibleSteps.map((step, index) => { const status = data[step.id]; const done = status.complete; const Icon = step.icon; const isNext = step.id === next.id; return (
            <div key={step.id} className={`flex items-center gap-3 rounded-lg border p-3 transition ${done ? "border-transparent bg-muted/40" : isNext ? "border-primary/30 bg-card" : "bg-card/70"}`}>
              {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] text-muted-foreground">{index + 1}</span>}
              <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className={`text-sm font-medium ${done ? "text-muted-foreground" : ""}`}>{step.title}</p><p className="text-xs text-muted-foreground">{done ? status.detail : step.description}</p></div>
              {!done && !isNext && <Button size="sm" variant="outline" asChild><Link to={step.to}>Open</Link></Button>}
              {done && <Badge variant="outline">Done</Badge>}
            </div>
          ); })}
        </div>
        <p className="pt-1 text-center text-[11px] text-muted-foreground">Your guide adapts to your role and live school progress. You can complete steps in any order.</p>
      </CardContent>
    </Card>
  );
}
