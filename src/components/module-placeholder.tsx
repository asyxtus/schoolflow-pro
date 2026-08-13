import { Construction } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
  nextUp,
}: {
  title: string;
  description: string;
  nextUp: string[];
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent/25 text-accent-foreground">
            <Construction className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">This module is being built</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              We're establishing the design system and student information core first, then
              unlocking modules top-down. Here's what's queued next:
            </p>
          </div>
          <ul className="mt-1 space-y-1.5 text-sm text-foreground">
            {nextUp.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
