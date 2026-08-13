import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2 } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocuments,
  getUploadPath,
  recordDocument,
  getDocumentUrl,
  deleteDocument,
  DOCUMENT_CATEGORIES,
  type DocumentOwnerType,
} from "@/lib/documents.functions";

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentVaultCard({
  ownerType,
  ownerId,
  title = "Documents",
}: {
  ownerType: DocumentOwnerType;
  ownerId?: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const fetchDocs = useServerFn(listDocuments);
  const fetchUploadPath = useServerFn(getUploadPath);
  const recordFn = useServerFn(recordDocument);
  const urlFn = useServerFn(getDocumentUrl);
  const deleteFn = useServerFn(deleteDocument);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);

  const queryKey = ["documents", ownerType, ownerId ?? "none"];
  const listQ = useQuery({
    queryKey,
    queryFn: () => fetchDocs({ data: { ownerType, ownerId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setDocTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const upload = async () => {
    if (!pendingFile) return;
    if (!docTitle.trim()) {
      toast.error("Enter a title");
      return;
    }
    setUploading(true);
    try {
      const { path, bucket } = await fetchUploadPath({
        data: { ownerType, ownerId, fileName: pendingFile.name },
      });
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, pendingFile, {
        contentType: pendingFile.type || undefined,
      });
      if (upErr) throw upErr;
      await recordFn({
        data: {
          ownerType,
          ownerId,
          category,
          title: docTitle.trim(),
          storagePath: path,
          fileName: pendingFile.name,
          mimeType: pendingFile.type || undefined,
          fileSize: pendingFile.size,
        },
      });
      toast.success("Document uploaded");
      setPendingFile(null);
      setDocTitle("");
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const view = async (storagePath: string) => {
    try {
      const { url } = await urlFn({ data: { storagePath } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string, storagePath: string) => {
    try {
      await deleteFn({ data: { id, storagePath } });
      invalidate();
      toast.success("Document deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
      </CardHeader>
      <CardContent>
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (listQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="divide-y">
            {(listQ.data ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.category} · {formatBytes(d.file_size)} ·{" "}
                      {new Date(d.created_at).toLocaleDateString()}
                      {d.expires_on && ` · Expires ${new Date(d.expires_on).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => view(d.storage_path)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(d.id, d.storage_path)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="truncate text-sm text-muted-foreground">{pendingFile?.name}</p>
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFile(null)}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
