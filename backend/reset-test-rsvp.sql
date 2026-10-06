-- Deletes only the specified test RSVP and its delivery records so it can register again.
begin;
delete from elab_private.confirmation_emails where email = 'ppnkl123@gmail.com';
do $$
begin
  if to_regclass('elab_private.organizer_notifications') is not null then
    execute 'delete from elab_private.organizer_notifications where email = $1'
      using 'ppnkl123@gmail.com';
  end if;
end;
$$;
delete from elab_private.party_rsvps where email = 'ppnkl123@gmail.com' returning name, email;
commit;
