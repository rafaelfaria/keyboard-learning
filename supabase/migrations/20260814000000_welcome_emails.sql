-- One row per user who has been sent the welcome email, written by the
-- notify-welcome-new-user edge function (service role). The PRIMARY KEY is the
-- idempotency gate: the auth webhook can fire more than once per user (OAuth
-- INSERT, magic-link confirm UPDATE, retries), but only the first insert here
-- succeeds, so only one email ever goes out.
create table public.welcome_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now()
);

-- Service-role only. RLS on with no policies blocks anon/authenticated even if
-- a grant sneaks in later; the function's service role bypasses RLS by design.
alter table public.welcome_emails enable row level security;

comment on table public.welcome_emails is
  'Welcome-email send log + idempotency gate for notify-welcome-new-user. Service role only.';
