import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvitationByToken, acceptInvitation } from "@/lib/admin.functions";

const search = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/_authenticated/accept-invite")({
  validateSearch: search,
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const lookup = useServerFn(getInvitationByToken);
  const accept = useServerFn(acceptInvitation);

  const { data, isLoading } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => lookup({ data: { token: token! } }),
    enabled: !!token,
  });

  const acceptMut = useMutation({
    mutationFn: () => accept({ data: { token: token! } }),
    onSuccess: (r) => {
      toast.success(r.dioceseId ? "Welcome to the diocese!" : "Welcome to the school!");
      navigate({ to: r.dioceseId ? "/diocese" : "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!token) {
    return <Center>Missing invitation token.</Center>;
  }
  if (isLoading) return <Center>Loading invitation…</Center>;
  if (!data) return <Center>Invitation not found.</Center>;

  const school = (data as { schools?: { name?: string; city?: string; region?: string } }).schools;
  const diocese = (data as { dioceses?: { name?: string } }).dioceses;
  const expired = new Date(data.expires_at).getTime() < Date.now();

  return (
    <div className="min-h-[80vh] grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {diocese ? `Join ${diocese.name}` : `Join ${school?.name ?? "the school"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {diocese ? (
              <>
                You've been invited to administer{" "}
                <strong className="text-foreground">{diocese.name}</strong> as{" "}
                <strong className="text-foreground">{data.role}</strong>.
              </>
            ) : (
              <>
                You've been invited to join{" "}
                <strong className="text-foreground">{school?.name}</strong>
                {school?.city ? ` (${school.city})` : ""} as{" "}
                <strong className="text-foreground">{data.role}</strong>.
              </>
            )}
          </div>
          <div className="rounded-md bg-muted p-3 text-xs">
            Invitation for: <strong>{data.email}</strong>
          </div>
          {data.status !== "pending" ? (
            <div className="text-sm text-destructive">This invitation is {data.status}.</div>
          ) : expired ? (
            <div className="text-sm text-destructive">This invitation has expired.</div>
          ) : (
            <Button
              className="w-full"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
            >
              {acceptMut.isPending ? "Accepting…" : "Accept invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] grid place-items-center text-muted-foreground">{children}</div>
  );
}
