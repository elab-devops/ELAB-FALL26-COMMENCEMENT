-- Run only against a disposable PostgreSQL database with anon/authenticated roles.
begin;
set local role anon;
select public.register_party_rsvp(' Guest@Example.com ', 'Anna');
select public.register_party_rsvp('guest@example.com', 'Overwrite attempt');
select public.register_party_rsvp('plus-one@example.com', 'Sam', true, ' Alex ', ' Alex@Example.com ');
select public.register_party_rsvp('optional-email@example.com', 'Sam', true, 'Alex', '');
select public.register_party_rsvp('multiple@example.com', 'Sam', true, 'Alex, Jo',
  ' Jo@Example.com, alex@example.com, JO@example.com ');
do $$
begin
  if has_schema_privilege(current_user, 'elab_private', 'USAGE') then
    raise exception 'Guest schema is accessible';
  end if;
  begin
    perform public.register_party_rsvp('not-an-email', 'Anna');
    raise exception 'Invalid email accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_party_rsvp('valid@example.com', repeat('x', 101));
    raise exception 'Oversized name accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_party_rsvp('valid@example.com', 'Sam', true, '', '');
    raise exception 'Missing companion name accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_party_rsvp('valid@example.com', 'Sam', true, 'Alex', 'invalid-email');
    raise exception 'Invalid companion email accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_party_rsvp('valid@example.com', 'Sam', true, 'Alex, Jo', 'alex@example.com, broken');
    raise exception 'Invalid address in email list accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_party_rsvp('valid@example.com', 'Sam', true, 'Alex', 'alex@example.com,');
    raise exception 'Empty address in email list accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform * from elab_private.party_rsvps;
    raise exception 'Guest records can be read';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from elab_private.party_rsvps) <> 4 then
    raise exception 'Unexpected registration count';
  end if;
  if not exists (select 1 from elab_private.party_rsvps where email = 'multiple@example.com'
    and companion_email = 'alex@example.com, jo@example.com') then
    raise exception 'Multiple email normalization failed';
  end if;
  if not exists (select 1 from elab_private.party_rsvps where email = 'guest@example.com' and name = 'Anna') then
    raise exception 'Normalization or duplicate protection failed';
  end if;
  if not exists (select 1 from elab_private.party_rsvps where email = 'plus-one@example.com'
    and bringing_someone and companion_name = 'Alex' and companion_email = 'alex@example.com') then
    raise exception 'Companion details were not saved correctly';
  end if;
  if not exists (select 1 from elab_private.party_rsvps where email = 'optional-email@example.com'
    and bringing_someone and companion_email is null) then
    raise exception 'Optional email was not handled correctly';
  end if;
  if has_function_privilege('authenticated', 'public.register_party_rsvp(text,text,boolean,text,text)', 'EXECUTE') then
    raise exception 'Unexpected authenticated access';
  end if;
end;
$$;
rollback;
