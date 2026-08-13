import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, LogOut, MessageSquarePlus, Check, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listVisitors,
  checkInVisitor,
  checkOutVisitor,
  deleteVisitorEntry,
  listMessages,
  logMessage,
  markMessageDelivered,
  deleteMessage,
} from "@/lib/reception.functions";

export const Route = createFileRoute("/_authenticated/reception")({
  component: ReceptionPage,
});

function ReceptionPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeader title="Reception" description="Visitor sign-in and message intake." />
      <Tabs defaultValue="visitors">
        <TabsList>
          <TabsTrigger value="visitors">Visitor Log</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="visitors" className="mt-4">
          <VisitorLog />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessageLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitorLog() {
  const qc = useQueryClient();
  const fetchVisitors = useServerFn(listVisitors);
  const checkInFn = useServerFn(checkInVisitor);
  const checkOutFn = useServerFn(checkOutVisitor);
  const deleteFn = useServerFn(deleteVisitorEntry);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [host, setHost] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const listQ = useQuery({
    queryKey: ["visitor-log", activeOnly],
    queryFn: () => fetchVisitors({ data: { activeOnly } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["visitor-log"], exact: false });

  const checkIn = async () => {
    if (!name.trim()) {
      toast.error("Enter the visitor's name");
      return;
    }
    try {
      await checkInFn({
        data: { visitorName: name, visitorPhone: phone, purpose, hostName: host },
      });
      setName("");
      setPhone("");
      setPurpose("");
      setHost("");
      invalidate();
      toast.success("Visitor signed in");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Visitor name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Purpose (optional)</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Here to see (optional)</Label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={checkIn}>
              <UserPlus className="mr-2 h-4 w-4" />
              Sign in visitor
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setActiveOnly((v) => !v)}>
          {activeOnly ? "Show all" : "Show currently in building only"}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Here to see</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data ?? []).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.visitor_name}
                  {v.visitor_phone && (
                    <div className="text-xs text-muted-foreground">{v.visitor_phone}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{v.purpose ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {v.host_name ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(v.check_in_at).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {v.check_out_at ? (
                    new Date(v.check_out_at).toLocaleTimeString()
                  ) : (
                    <Badge variant="secondary">In building</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {!v.check_out_at && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Check out"
                        onClick={async () => {
                          await checkOutFn({ data: { id: v.id } });
                          invalidate();
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete"
                      onClick={async () => {
                        try {
                          await deleteFn({ data: { id: v.id } });
                          invalidate();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(listQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No visitors.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function MessageLog() {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(listMessages);
  const logFn = useServerFn(logMessage);
  const deliveredFn = useServerFn(markMessageDelivered);
  const deleteFn = useServerFn(deleteMessage);

  const [forStaff, setForStaff] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);

  const listQ = useQuery({
    queryKey: ["message-log", pendingOnly],
    queryFn: () => fetchMessages({ data: { pendingOnly } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["message-log"], exact: false });

  const submit = async () => {
    try {
      await logFn({
        data: { forStaffName: forStaff, callerName, callerPhone, message },
      });
      setForStaff("");
      setCallerName("");
      setCallerPhone("");
      setMessage("");
      invalidate();
      toast.success("Message logged");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">For (staff member)</Label>
            <Input value={forStaff} onChange={(e) => setForStaff(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Caller's name</Label>
            <Input value={callerName} onChange={(e) => setCallerName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Caller's phone (optional)</Label>
            <Input value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs">Message</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={submit}>
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              Log message
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setPendingOnly((v) => !v)}>
          {pendingOnly ? "Show all" : "Show pending only"}
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {(listQ.data ?? []).map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">
                  For {m.for_staff_name} — from {m.caller_name}
                  {m.caller_phone && ` (${m.caller_phone})`}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                  {m.delivered && " · Delivered"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!m.delivered && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Mark delivered"
                    onClick={async () => {
                      await deliveredFn({ data: { id: m.id } });
                      invalidate();
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  title="Delete"
                  onClick={async () => {
                    try {
                      await deleteFn({ data: { id: m.id } });
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {(listQ.data ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No messages.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
