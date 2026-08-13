
-- Staff of a school can upload/read/delete receipts under their school-id prefix
CREATE POLICY "Staff read expense receipts" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.is_staff_of_school(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "Staff upload expense receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND public.can_manage_school_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "Staff delete expense receipts" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.can_manage_school_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
