import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const search = z.object({ name: z.string().optional() });

export const Route = createFileRoute("/school-deactivated")({
  validateSearch: search,
  component: SchoolDeactivatedPage,
});

function SchoolDeactivatedPage() {
  const { name } = Route.useSearch();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{name ? `${name} is deactivated` : "This school is deactivated"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Access to this account has been suspended by the platform administrator. If you believe
            this is a mistake, please get in touch with them directly.
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
