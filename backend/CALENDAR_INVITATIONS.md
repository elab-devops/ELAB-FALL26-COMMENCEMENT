# Calendar invitations from Anna's TUM.ai calendar

The website stores RSVPs in Supabase. The confirmation email says the calendar
invitation will follow. Anna manually adds those guests to one Google Calendar
event; calendar invitations are not sent automatically by Supabase.

## Use the event already created

1. Sign into Google Calendar as anna.papanakli@tum-ai.com.
2. Open the existing ELAB FALL 2026 COMMENCEMENT event and click the pencil.
   Its event ID is 6946puj3p42m8memqjcterbq16 on Anna's TUM.ai calendar.
   Do not create another event if this one is correct.
3. Check the calendar selector is Anna's TUM.ai calendar, not a personal Gmail
   calendar. Confirm October 17, 2026 at 19:00 through October 18 at 00:00,
   Europe/Berlin (Munich's time zone). Keep the event timed, not all-day.
4. Set the location to "Munich — location coming soon" and keep one website link
   in the description. A suggested description:

   Come and meet the new batch.
   We have room for 2–3 short stories about ELAB or venture experiences.
   If you'd like to share one, reply to your confirmation email.
   https://elab-devops.github.io/ELAB-FALL26-COMMENCEMENT/

5. Under Guest permissions, uncheck See guest list, Invite others, and Modify event.
   Leave the calendar unshared with guests. People who already have higher-level
   access to the calendar may still be able to see guests.
6. Save. Test first by adding Anna's personal Gmail address under Guests and
   clicking Save → Send. Accept the invitation in that inbox. Confirm it identifies
   Anna as organizer and shows the correct date/time. Remove an old imported
   calendar copy if necessary to avoid duplicates.

## Invite people who RSVP

1. Run backend/calendar-guests.sql in Supabase SQL Editor. It returns the primary
   RSVP addresses and optional companion addresses, deduplicated.
2. Copy the result into the existing event's Guests field. Keep existing guests
   and their responses. Google should recognize already-added addresses; check
   the list before saving.
3. Click Save and choose Send when Google asks about invitations. Guests may
   need to accept the invitation before it appears on their calendar.
4. Repeat as more people RSVP. There is no need to attach a downloaded .ics file
   or publish the event/calendar publicly.

Names without companion email addresses remain on the RSVP list. Their host
receives the calendar invitation; the companion does not receive an individual
invitation until you add an email address manually.

## Add the venue later

Edit the same event, change Location, save, and choose Send updates. Guests
receive an update to the same invitation. Other calendar clients can differ in
how they apply updates, so send the email notification. Also update the website's
event configuration and regenerate/redeploy the confirmation email function.

## Find prospective speakers

After running backend/speaker-interest.sql:

```sql
select name, email, registered_at
from elab_private.party_rsvps
where interested_in_speaking
order by registered_at;
```

The checkbox expresses interest, not a guaranteed speaking slot. The confirmation
email also invites everyone to reply with a story idea, including people who did
not select the checkbox. Replies go to anna.papanakli@tum-ai.com.

Existing RSVPs default to no speaking interest. Repeat form submissions do not
change an existing registration; existing guests can reply to the email instead.
