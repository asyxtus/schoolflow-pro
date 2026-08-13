import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listMessages,
  sendMessage,
  deleteMessage,
  type MessageAudience,
} from "@/lib/messages.functions";
import { listClassNames } from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const del = useServerFn(deleteMessage);
  const classesFn = useServerFn(listClassNames);

  const msgsQ = useQuery({ queryKey: ["messages"], queryFn: () => list() });
  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => classesFn() });

  const [audience, setAudience] = useState<MessageAudience>("all");
  const [audClass, setAudClass] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendMut = useMutation({
    mutationFn: () =>
      send({ data: { audience, audience_class: audClass || undefined, subject, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Message sent");
      setSubject("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader title="Messages" description="Broadcast announcements to your school" />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">New message</h2>
            <div className="grid gap-1.5">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as MessageAudience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole school</SelectItem>
                  <SelectItem value="class">Specific class</SelectItem>
                  <SelectItem value="staff">Staff only</SelectItem>
                  <SelectItem value="guardians">Guardians only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audience === "class" && (
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={audClass} onValueChange={setAudClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classesQ.data ?? []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. PTA meeting Friday"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Message</Label>
              <Textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your announcement…"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendMut.mutate()}
              disabled={
                !subject.trim() ||
                !body.trim() ||
                sendMut.isPending ||
                (audience === "class" && !audClass)
              }
            >
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent messages</h2>
          {msgsQ.isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : !msgsQ.data?.length ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No messages yet.
              </CardContent>
            </Card>
          ) : (
            msgsQ.data.map((m) => (
              <Card key={m.id} className="relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
                <CardContent className="space-y-2 p-4 pl-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{m.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {m.audience === "class" ? `Class ${m.audience_class}` : m.audience}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => delMut.mutate(m.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{m.body}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
