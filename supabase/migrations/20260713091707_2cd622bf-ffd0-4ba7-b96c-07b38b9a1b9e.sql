-- School-level wallet defaults
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS wallet_default_per_txn_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_default_daily_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_default_weekly_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_default_monthly_limit BIGINT;

-- Per-student overrides (NULL = fall back to school defaults)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS wallet_per_txn_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_daily_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_weekly_limit BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_monthly_limit BIGINT;

-- Guardian approval tracking on withdrawals
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS over_limit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_approval_note TEXT;