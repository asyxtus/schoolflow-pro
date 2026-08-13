import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type DocumentOwnerType = "student" | "staff" | "school";

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ownerType: DocumentOwnerType; ownerId?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("documents")
      .select(
        "id, category, title, file_name, mime_type, file_size, notes, expires_on, storage_path, created_at",
      )
      .eq("school_id", schoolId)
      .eq("owner_type", data.ownerType)
      .order("created_at", { ascending: false });
    q = data.ownerId ? q.eq("owner_id", data.ownerId) : q.is("owner_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Returns the school-scoped storage path the client should upload to —
// the client performs the actual upload via the browser Supabase client
// (storage RLS enforces the same school-id-prefix check independently),
// then calls recordDocument to save the metadata row.
export const getUploadPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ownerType: DocumentOwnerType; ownerId?: string; fileName: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school assigned");
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const scope = data.ownerId ?? "general";
    const path = `${schoolId}/${data.ownerType}/${scope}/${Date.now()}-${safeName}`;
    return { path, bucket: "documents" };
  });

export const recordDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ownerType: DocumentOwnerType;
      ownerId?: string;
      category: string;
      title: string;
      storagePath: string;
      fileName: string;
      mimeType?: string;
      fileSize?: number;
      notes?: string;
      expiresOn?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.title.trim()) throw new Error("Title is required");
    const { error } = await supabase.from("documents").insert({
      school_id: schoolId,
      owner_type: data.ownerType,
      owner_id: data.ownerId ?? null,
      category: data.category,
      title: data.title.trim(),
      storage_path: data.storagePath,
      file_name: data.fileName,
      mime_type: data.mimeType ?? null,
      file_size: data.fileSize ?? null,
      notes: data.notes?.trim() || null,
      expires_on: data.expiresOn || null,
      uploaded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storagePath: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("documents")
      .createSignedUrl(data.storagePath, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; storagePath: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error: sErr } = await supabase.storage.from("documents").remove([data.storagePath]);
    if (sErr) throw new Error(sErr.message);
    const { error } = await supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const DOCUMENT_CATEGORIES = [
  "Birth Certificate",
  "Transfer Certificate",
  "ID Photo",
  "Report Card",
  "Medical Record",
  "Contract",
  "ID / Passport Copy",
  "Certificate / Diploma",
  "Policy",
  "Other",
] as const;
