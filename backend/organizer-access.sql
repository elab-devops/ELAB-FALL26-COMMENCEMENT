begin;
create table if not exists elab_private.organizer_attempts (
  key text primary key, window_started timestamptz not null, attempts integer not null
);
alter table elab_private.organizer_attempts enable row level security;
revoke all on elab_private.organizer_attempts from public, anon, authenticated;
create or replace function public.organizer_login_allowed(attempt_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_attempts integer;
begin
  if length(attempt_key) <> 64 then return false; end if;
  delete from elab_private.organizer_attempts where window_started < now() - interval '1 day';
  insert into elab_private.organizer_attempts as a values (attempt_key, now(), 1)
  on conflict (key) do update set
    attempts = case when a.window_started < now() - interval '15 minutes' then 1 else a.attempts + 1 end,
    window_started = case when a.window_started < now() - interval '15 minutes' then now() else a.window_started end
  returning attempts into count_attempts;
  return count_attempts <= 10;
end;
$$;
create or replace function public.organizer_rsvp_list()
returns jsonb language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r.registered_at desc), '[]'::jsonb)
 from (select name,email,bringing_someone,companion_name,companion_email,
 interested_in_speaking,registered_at from elab_private.party_rsvps) r;
$$;
revoke all on function public.organizer_login_allowed(text) from public,anon,authenticated;
revoke all on function public.organizer_rsvp_list() from public,anon,authenticated;
grant execute on function public.organizer_login_allowed(text) to service_role;
grant execute on function public.organizer_rsvp_list() to service_role;
commit;
