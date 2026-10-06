-- Disposable PostgreSQL only, after organizer-notifications.sql and setup.sql.
begin;
set local role anon;
select public.register_party_rsvp('notification@example.com', 'New guest', true, 'Alex, Sam', 'alex@example.com, sam@example.com');
select public.register_party_rsvp('notification@example.com', 'Repeated submission');
do $$
begin
  begin
    perform * from public.claim_organizer_notifications();
    raise exception 'Public caller could claim organizer notifications';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from elab_private.organizer_notifications) <> 1 then
    raise exception 'Notification count does not match distinct RSVPs';
  end if;
end;
$$;
set local role service_role;
do $$
declare first_claim record;
begin
  select * into first_claim from public.claim_organizer_notifications();
  if first_claim.email <> 'notification@example.com'
     or first_claim.companion_email <> 'alex@example.com, sam@example.com' then
    raise exception 'Organizer notification details are incorrect';
  end if;
  if exists(select 1 from public.claim_organizer_notifications()) then
    raise exception 'Leased notification was claimed twice';
  end if;
  perform public.finish_organizer_notification(first_claim.email, first_claim.lease_id, true);
end;
$$;
reset role;
do $$
begin
  if not exists(select 1 from elab_private.organizer_notifications where sent_at is not null and attempts = 1) then
    raise exception 'Organizer delivery was not recorded';
  end if;
end;
$$;
rollback;
