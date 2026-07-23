import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPortalBundle } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const bundleQuery = (token: string) => ({
  queryKey: ["portal", token] as const,
  queryFn: () => getPortalBundle({ data: { token } }),
});

export const Route = createFileRoute("/portal/$token")({
  head: () => ({
    meta: [
      { title: "Parent Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(bundleQuery(params.token)),
  component: PortalPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <InvalidLink />,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

function InvalidLink() {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold">Link no longer valid</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask the school office for a new link.
      </p>
    </div>
  );
}

function PortalPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(bundleQuery(token));
  if (!data?.ok) return <InvalidLink />;
  const { student, school, fees, payments, attendance, grades, messages } = data;
  if (!student || !school) return <InvalidLink />;

  const balance = student.fee_balance ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {school.name} · {[school.city, school.region].filter(Boolean).join(", ")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          {student.last_name} {student.first_name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{student.matricule}</span>
          <span>·</span>
          <span>{student.class_name ?? "—"}</span>
          <Badge variant={balance > 0 ? "destructive" : "secondary"}>
            Balance {fmt(balance)}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="fees" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="fees" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>
              {fees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.label}</TableCell>
                        <TableCell>{f.due_date ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {fmt(Math.max((f.amount_fcfa ?? 0) - (f.discount_fcfa ?? 0), 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{p.receipt_no ?? "—"}</TableCell>
                        <TableCell className="capitalize">{p.method}</TableCell>
                        <TableCell className="text-right">{fmt(p.amount_fcfa ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Grades</CardTitle></CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <p className="text-sm text-muted-foreground">No grades published yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Exam</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>{g.subject}</TableCell>
                        <TableCell>{g.sequence}</TableCell>
                        <TableCell className="text-right">{g.ca_score ?? "—"}</TableCell>
                        <TableCell className="text-right">{g.exam_score ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Recent attendance</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>{a.subject ?? "General"}</TableCell>
                        <TableCell className="capitalize">{a.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages from the school yet.</p>
          ) : (
            messages.map((m) => (
              <Card key={m.id}>
                <CardHeader>
                  <CardTitle className="text-base">{m.subject ?? "Message"}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm">{m.body}</CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}