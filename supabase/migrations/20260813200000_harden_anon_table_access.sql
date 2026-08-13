-- Security hardening for application data.
-- Anonymous clients must not have direct CRUD privileges on protected school data.
REVOKE ALL PRIVILEGES ON TABLE public.students FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.student_fees FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.student_fee_status FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.payment_allocations FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.wallet_transactions FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_roles FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.guardians FROM anon;
