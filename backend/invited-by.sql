-- Run before publishing the new RSVP field. Existing registrations are preserved.
begin;
alter table elab_private.party_rsvps add column if not exists invited_by text check (length(invited_by) <= 100);
drop function if exists public.register_party_rsvp(text, text, boolean, text, text, boolean);
create or replace function public.register_party_rsvp(guest_email text, guest_name text,
  bringing_someone boolean default false, companion_name text default '', companion_email text default '', interested_in_speaking boolean default false, invited_by text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_invited_by text := nullif(btrim(coalesce(invited_by, '')), '');
  normalized_email text := lower(btrim(guest_email));
  normalized_name text := btrim(coalesce(guest_name, ''));
  normalized_companion_name text := nullif(btrim(coalesce(companion_name, '')), '');
  normalized_companion_email text := nullif(lower(btrim(coalesce(companion_email, ''))), '');
begin
  if normalized_email is null
     or length(normalized_email) > 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(normalized_name) not between 1 and 100
     or bringing_someone is null
     or interested_in_speaking is null
     or length(normalized_invited_by) > 100
     or (bringing_someone and (normalized_companion_name is null or length(normalized_companion_name) > 100))
     or (bringing_someone and normalized_companion_email is not null and
       (length(normalized_companion_email) > 2000 or exists (
         select 1 from regexp_split_to_table(normalized_companion_email, ',') as addresses(address)
         where length(btrim(address)) > 254
           or btrim(address) !~ '^[^[:space:]@,]+@[^[:space:]@,]+\.[^[:space:]@,]+$'
       ))) then
    raise exception 'Invalid RSVP details' using errcode = '22023';
  end if;
  if bringing_someone and normalized_companion_email is not null then
    select string_agg(address, ', ' order by address) into normalized_companion_email
    from (select distinct btrim(address) as address
      from regexp_split_to_table(normalized_companion_email, ',') as addresses(address)) as unique_addresses;
  end if;
  insert into elab_private.party_rsvps(email, name, bringing_someone, companion_name, companion_email, interested_in_speaking, invited_by)
  values (normalized_email, normalized_name, bringing_someone,
    case when bringing_someone then normalized_companion_name else null end,
    case when bringing_someone then normalized_companion_email else null end, interested_in_speaking, normalized_invited_by)
  on conflict (email) do nothing;
  -- New and repeated registrations return the same empty response.
  -- Callers cannot read the guest list or overwrite an existing registration.
end;
$$;
revoke all on function public.register_party_rsvp(text, text, boolean, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.register_party_rsvp(text, text, boolean, text, text, boolean, text) to anon;
create or replace function public.organizer_rsvp_list()
returns jsonb language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r.registered_at desc), '[]'::jsonb)
 from (select name,email,invited_by,bringing_someone,companion_name,companion_email,
 interested_in_speaking,invited,companion_count,registered_at from elab_private.party_rsvps) r;
$$;
revoke all on function public.organizer_rsvp_list() from public,anon,authenticated;
grant execute on function public.organizer_rsvp_list() to service_role;
notify pgrst, 'reload schema';
commit;
