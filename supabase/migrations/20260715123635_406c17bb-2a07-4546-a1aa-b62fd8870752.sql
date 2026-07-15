
-- ─── TRANSPORT ───────────────────────────────────────────────────────────
CREATE TABLE public.transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plate_no text NOT NULL,
  model text,
  capacity int NOT NULL DEFAULT 0,
  driver_name text,
  driver_phone text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_vehicles TO authenticated;
GRANT ALL ON public.transport_vehicles TO service_role;
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_school_read" ON public.transport_vehicles FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "vehicles_school_write" ON public.transport_vehicles FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_transport_vehicles_updated BEFORE UPDATE ON public.transport_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  vehicle_id uuid REFERENCES public.transport_vehicles(id) ON DELETE SET NULL,
  stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_fee_fcfa bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;
GRANT ALL ON public.transport_routes TO service_role;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_school_read" ON public.transport_routes FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "routes_school_write" ON public.transport_routes FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_transport_routes_updated BEFORE UPDATE ON public.transport_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transport_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_name text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  monthly_fee_fcfa bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_subscriptions TO authenticated;
GRANT ALL ON public.transport_subscriptions TO service_role;
ALTER TABLE public.transport_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_school_read" ON public.transport_subscriptions FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "subs_school_write" ON public.transport_subscriptions FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_transport_subs_updated BEFORE UPDATE ON public.transport_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transport_boarding_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  direction text NOT NULL DEFAULT 'am',
  boarded boolean NOT NULL DEFAULT true,
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_boarding_log TO authenticated;
GRANT ALL ON public.transport_boarding_log TO service_role;
ALTER TABLE public.transport_boarding_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbl_school_read" ON public.transport_boarding_log FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "tbl_school_write" ON public.transport_boarding_log FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));

CREATE TABLE public.transport_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.transport_vehicles(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  incident_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL DEFAULT 'incident',
  severity text,
  cost_fcfa bigint NOT NULL DEFAULT 0,
  description text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_incidents TO authenticated;
GRANT ALL ON public.transport_incidents TO service_role;
ALTER TABLE public.transport_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_school_read" ON public.transport_incidents FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "incidents_school_write" ON public.transport_incidents FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_transport_incidents_updated BEFORE UPDATE ON public.transport_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── LIBRARY ─────────────────────────────────────────────────────────────
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  publisher text,
  year int,
  location text,
  cover_url text,
  total_copies int NOT NULL DEFAULT 0,
  available_copies int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books_school_read" ON public.library_books FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "books_school_write" ON public.library_books FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_library_books_updated BEFORE UPDATE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.library_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  barcode text,
  status text NOT NULL DEFAULT 'available',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_copies TO authenticated;
GRANT ALL ON public.library_copies TO service_role;
ALTER TABLE public.library_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copies_school_read" ON public.library_copies FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "copies_school_write" ON public.library_copies FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_library_copies_updated BEFORE UPDATE ON public.library_copies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  copy_id uuid NOT NULL REFERENCES public.library_copies(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  borrower_type text NOT NULL DEFAULT 'student',
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  loaned_at timestamptz NOT NULL DEFAULT now(),
  due_date date NOT NULL,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_school_read" ON public.library_loans FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "loans_school_write" ON public.library_loans FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_library_loans_updated BEFORE UPDATE ON public.library_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.library_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  borrower_type text NOT NULL DEFAULT 'student',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_reservations TO authenticated;
GRANT ALL ON public.library_reservations TO service_role;
ALTER TABLE public.library_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_school_read" ON public.library_reservations FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "reservations_school_write" ON public.library_reservations FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_library_reservations_updated BEFORE UPDATE ON public.library_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Helpers to keep book copy counts in sync ────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_book_counts(_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t int; a int;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'available')
    INTO t, a FROM public.library_copies WHERE book_id = _book_id;
  UPDATE public.library_books SET total_copies = COALESCE(t,0), available_copies = COALESCE(a,0)
    WHERE id = _book_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_book_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_book_counts(OLD.book_id); RETURN OLD;
  ELSE
    PERFORM public.recompute_book_counts(NEW.book_id);
    IF TG_OP = 'UPDATE' AND NEW.book_id <> OLD.book_id THEN
      PERFORM public.recompute_book_counts(OLD.book_id);
    END IF;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER trg_copies_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.library_copies
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_book_counts();
