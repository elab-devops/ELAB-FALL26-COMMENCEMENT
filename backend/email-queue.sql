-- Run after backend/setup.sql. Only future RSVPs are queued automatically.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists elab_private.confirmation_emails (
  email text primary key references elab_private.party_rsvps(email),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  sent_at timestamptz,
  last_error text
);
alter table elab_private.confirmation_emails enable row level security;
revoke all on elab_private.confirmation_emails from public, anon, authenticated;

create or replace function elab_private.queue_confirmation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into elab_private.confirmation_emails(email) values(new.email)
  on conflict(email) do nothing;
  return new;
end;
$$;
revoke all on function elab_private.queue_confirmation() from public, anon, authenticated;
drop trigger if exists queue_confirmation on elab_private.party_rsvps;
create trigger queue_confirmation after insert on elab_private.party_rsvps
for each row execute function elab_private.queue_confirmation();

create or replace function public.claim_confirmation_emails()
returns table(email text, name text, bringing_someone boolean, companion_name text, lease_id uuid)
language sql security definer set search_path = '' as $$
  with due as (
    select q.email from elab_private.confirmation_emails q
    where q.sent_at is null and q.attempts < 5 and q.next_attempt_at <= now()
    order by q.next_attempt_at for update skip locked limit 5
  ), claimed as (
    update elab_private.confirmation_emails q
    set attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes',
        lease_id = gen_random_uuid()
    from due where q.email = due.email returning q.email, q.lease_id
  )
  select r.email, r.name, r.bringing_someone, r.companion_name, c.lease_id
  from claimed c join elab_private.party_rsvps r on r.email = c.email;
$$;

create or replace function public.finish_confirmation_email(
  recipient_email text, delivery_lease uuid, delivered boolean)
returns void language sql security definer set search_path = '' as $$
  update elab_private.confirmation_emails
  set sent_at = case when delivered then now() else null end,
      last_error = case when delivered then null else 'SMTP delivery failed; see Edge Function logs' end
  where email = recipient_email and lease_id = delivery_lease and sent_at is null;
$$;
revoke all on function public.claim_confirmation_emails() from public, anon, authenticated;
revoke all on function public.finish_confirmation_email(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_confirmation_emails() to service_role;
grant execute on function public.finish_confirmation_email(text, uuid, boolean) to service_role;

-- Generate a private worker token. Copy it into the Edge Function secret EMAIL_WORKER_TOKEN.
do $$
begin
  if not exists(select 1 from vault.secrets where name = 'elab_email_worker_token') then
    perform vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'elab_email_worker_token', 'Authenticates the ELAB email worker');
  end if;
end;
$$;
commit;

-- Keep this result private; do not put it in the repository or share a screenshot.
select decrypted_secret as "EMAIL_WORKER_TOKEN" from vault.decrypted_secrets
where name = 'elab_email_worker_token';
