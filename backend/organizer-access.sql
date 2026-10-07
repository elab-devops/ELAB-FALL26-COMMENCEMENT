begin;
alter table elab_private.party_rsvps add column if not exists invited boolean not null default false;
alter table elab_private.party_rsvps add column if not exists companion_count integer;
update elab_private.party_rsvps set companion_count = case when bringing_someone then
 greatest(1, cardinality(regexp_split_to_array(trim(companion_name), '\s*[,;\n&]\s*|\s+and\s+', 'i'))) else 0 end
where companion_count is null;
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
 interested_in_speaking,invited,companion_count,registered_at from elab_private.party_rsvps) r;
$$;
create or replace function public.organizer_set_invited(guest_email text, is_invited boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if is_invited is null then raise exception 'Invitation status is required'; end if;
  update elab_private.party_rsvps set invited = is_invited where email = guest_email;
  return found;
end;
$$;
revoke all on function public.organizer_set_invited(text,boolean) from public,anon,authenticated;
grant execute on function public.organizer_set_invited(text,boolean) to service_role;
revoke all on function public.organizer_login_allowed(text) from public,anon,authenticated;
revoke all on function public.organizer_rsvp_list() from public,anon,authenticated;
grant execute on function public.organizer_login_allowed(text) to service_role;
grant execute on function public.organizer_rsvp_list() to service_role;
create or replace function public.organizer_delete_rsvp(guest_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize against concurrent RSVP updates before removing dependent queues.
  perform 1 from elab_private.party_rsvps where email = guest_email for update;
  if not found then return false; end if;
  if to_regclass('elab_private.confirmation_emails') is not null then
    execute 'delete from elab_private.confirmation_emails where email = $1' using guest_email;
  end if;
  if to_regclass('elab_private.organizer_notifications') is not null then
    execute 'delete from elab_private.organizer_notifications where email = $1' using guest_email;
  end if;
  delete from elab_private.party_rsvps where email = guest_email;
  return found;
end;
$$;
revoke all on function public.organizer_delete_rsvp(text) from public,anon,authenticated;
grant execute on function public.organizer_delete_rsvp(text) to service_role;
create or replace function public.organizer_set_companion_count(guest_email text, guest_count integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if guest_count is null or guest_count < 0 or guest_count > 1000 then raise exception 'Invalid companion count'; end if;
  update elab_private.party_rsvps set companion_count = guest_count where email = guest_email;
  return found;
end;
$$;
revoke all on function public.organizer_set_companion_count(text,integer) from public,anon,authenticated;
grant execute on function public.organizer_set_companion_count(text,integer) to service_role;
commit;
