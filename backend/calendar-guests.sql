-- A deduplicated list to paste into the Google Calendar event's Guests field.
-- Includes optional companion addresses; companions without an address remain
-- on the RSVP list but cannot receive their own calendar invitation.
with addresses as (
  select email from elab_private.party_rsvps
  union
  select lower(btrim(address))
  from elab_private.party_rsvps r,
       lateral regexp_split_to_table(r.companion_email, ',') as companions(address)
  where r.bringing_someone and r.companion_email is not null
)
select string_agg(email, ', ' order by email) as "Calendar guests"
from addresses
where email <> '' and email <> 'anna.papanakli@tum-ai.com';
