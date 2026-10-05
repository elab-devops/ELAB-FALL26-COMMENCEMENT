-- Run once in your Supabase project's SQL Editor.
-- Guest data lives outside the public API schema. Only a write-only RSVP function is exposed.
begin;
create schema if not exists elab_private;
revoke all on schema elab_private from public, anon, authenticated;

create table if not exists elab_private.party_rsvps (
  email text primary key check (length(email) between 3 and 254),
  name text not null check (length(name) between 1 and 100),
  bringing_someone boolean not null default false,
  companion_name text check (length(companion_name) between 1 and 100),
  companion_email text check (length(companion_email) between 3 and 254),
  check ((bringing_someone and companion_name is not null) or
    (not bringing_someone and companion_name is null and companion_email is null)),
  registered_at timestamptz not null default now()
);
alter table elab_private.party_rsvps enable row level security;
revoke all on elab_private.party_rsvps from public, anon, authenticated;

create or replace function public.register_party_rsvp(guest_email text, guest_name text,
  bringing_someone boolean default false, companion_name text default '', companion_email text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
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
     or (bringing_someone and (normalized_companion_name is null or length(normalized_companion_name) > 100))
     or (bringing_someone and normalized_companion_email is not null and
       (length(normalized_companion_email) > 254 or normalized_companion_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
    raise exception 'Invalid RSVP details' using errcode = '22023';
  end if;
  insert into elab_private.party_rsvps(email, name, bringing_someone, companion_name, companion_email)
  values (normalized_email, normalized_name, bringing_someone,
    case when bringing_someone then normalized_companion_name else null end,
    case when bringing_someone then normalized_companion_email else null end)
  on conflict (email) do nothing;
  -- New and repeated registrations return the same empty response.
  -- Callers cannot read the guest list or overwrite an existing registration.
end;
$$;
revoke all on function public.register_party_rsvp(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.register_party_rsvp(text, text, boolean, text, text) to anon;
commit;
