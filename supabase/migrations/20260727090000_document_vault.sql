-- =========================================================================
-- Document Vault.
--
-- A private storage bucket ('documents') plus a metadata table so files can
-- be attached to a student, a staff member, or the school generally
-- (policies, handbooks). Follows the same storage RLS pattern already
-- reserved for expense receipts: objects are stored under a
-- {school_id}/... path, and policies check that prefix against the
-- uploader's own school.
--
-- Visibility is broad (any staff can view/upload — most of what lives here
-- is administrative: transfer certificates, ID copies, contracts, not
-- clinical data), but deletion is restricted to leadership, since removing
-- an official record should require oversight.
--
-- Every statement below is safe to re-run.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_owner_type') THEN
    CREATE TYPE public.document_owner_type AS ENUM ('student', 'staff', 'school');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  owner_type public.document_owner_type NOT NULL,
  owner_id UUID,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  notes TEXT,
  expires_on DATE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.documents(school_id, owner_type, owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view documents" ON public.documents;
CREATE POLICY "Staff view documents" ON public.documents FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Staff upload documents" ON public.documents;
CREATE POLICY "Staff upload documents" ON public.documents FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Staff edit document metadata" ON public.documents;
CREATE POLICY "Staff edit document metadata" ON public.documents FOR UPDATE
  TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Leadership delete documents" ON public.documents;
CREATE POLICY "Leadership delete documents" ON public.documents FOR DELETE
  TO authenticated USING (public.can_manage_school_data(auth.uid(), school_id));

-- Storage: same {school_id}/... prefix pattern as expense-receipts.
DROP POLICY IF EXISTS "Staff read vault documents" ON storage.objects;
CREATE POLICY "Staff read vault documents" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_staff_of_school(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Staff upload vault documents" ON storage.objects;
CREATE POLICY "Staff upload vault documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_staff_of_school(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Leadership delete vault documents" ON storage.objects;
CREATE POLICY "Leadership delete vault documents" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_manage_school_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
