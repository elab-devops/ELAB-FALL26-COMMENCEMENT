-- Run in Supabase SQL Editor to queue private notifications for future RSVPs.
begin;
create table if not exists elab_private.organizer_notifications (
  email text primary key references elab_private.party_rsvps(email),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  sent_at timestamptz,
  last_error text
);
alter table elab_private.organizer_notifications enable row level security;
revoke all on elab_private.organizer_notifications from public, anon, authenticated;

create or replace function elab_private.queue_organizer_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into elab_private.organizer_notifications(email) values(new.email)
  on conflict(email) do nothing;
  return new;
end;
$$;
revoke all on function elab_private.queue_organizer_notification() from public, anon, authenticated;
drop trigger if exists queue_organizer_notification on elab_private.party_rsvps;
create trigger queue_organizer_notification after insert on elab_private.party_rsvps
for each row execute function elab_private.queue_organizer_notification();

create or replace function public.claim_organizer_notifications()
returns table(email text, name text, bringing_someone boolean, companion_name text, companion_email text, interested_in_speaking boolean, lease_id uuid)
language sql security definer set search_path = '' as $$
  with due as (
    select q.email from elab_private.organizer_notifications q
    where q.sent_at is null and q.attempts < 5 and q.next_attempt_at <= now()
    order by q.next_attempt_at for update skip locked limit 5
  ), claimed as (
    update elab_private.organizer_notifications q
    set attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes',
        lease_id = gen_random_uuid()
    from due where q.email = due.email returning q.email, q.lease_id
  )
  select r.email, r.name, r.bringing_someone, r.companion_name, r.companion_email,
    coalesce((to_jsonb(r)->>'interested_in_speaking')::boolean, false), c.lease_id
  from claimed c join elab_private.party_rsvps r on r.email = c.email;
$$;

create or replace function public.finish_organizer_notification(
  recipient_email text, delivery_lease uuid, delivered boolean)
returns void language sql security definer set search_path = '' as $$
  update elab_private.organizer_notifications
  set sent_at = case when delivered then now() else null end,
      last_error = case when delivered then null else 'SMTP delivery failed; see Edge Function logs' end
  where email = recipient_email and lease_id = delivery_lease and sent_at is null;
$$;
revoke all on function public.claim_organizer_notifications() from public, anon, authenticated;
revoke all on function public.finish_organizer_notification(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_organizer_notifications() to service_role;
grant execute on function public.finish_organizer_notification(text, uuid, boolean) to service_role;

commit;
notify pgrst, 'reload schema';
