# RSVP backend

The invitation stays on GitHub Pages. Supabase stores names, email addresses, and registration times privately. Guests use a write-only database function; the public key cannot read the guest list, edit registrations, or delete them.

## Connect a project

1. Create a Supabase project in a European region.
2. In its **SQL Editor**, run `backend/setup.sql`.
3. From the project's **Connect** dialog or API settings, copy its project URL and **publishable** key.
4. Fill in `supabaseUrl` and `supabasePublishableKey` in `site-config.js`.
5. Never put a secret or service-role key in this repository or webpage.
6. Run `node --test tests/party.test.js`, then commit and push the files.

Until connected, the form's submit button says “RSVP opens soon” and is disabled. The y/n selector and companion fields can still be previewed. It does not pretend to save submissions or show a success confirmation.

## View or export attendees

Open the SQL Editor and run:

```sql
select name, email, bringing_someone, companion_name, companion_email, registered_at
from elab_private.party_rsvps
order by registered_at;
```

Export the results as CSV. Keep `elab_private` out of the Data API's exposed schemas. Each normalized email is stored once, and repeat submissions do not change the original registration.

## Confirmation emails

Optional Gmail confirmations promising a separate calendar invitation
are prepared in [EMAIL_SETUP.md](EMAIL_SETUP.md). They require deploying the
Supabase Edge Function and running the queue and schedule SQL; pushing website
files alone does not activate emails.

## Multiple companion emails

The companion email field accepts comma-separated addresses, normalizes their
case, and removes duplicates. For an existing database, run
`backend/multiple-companion-emails.sql` once in SQL Editor. New databases use
the updated `backend/setup.sql`. Each address is validated individually;
the combined field has a 2,000-character limit. Confirmation emails still go
to the registering guest only. Repeat submissions keep the original RSVP.

## Calendar invitations and event details

Event times are defined in `site-config.js`. The evening ends at midnight
(00:00 on October 18) Munich time. The RSVP confirmation says “Your calendar
invitation will follow.” The website and email do not offer independent calendar
copies. The old event.ics file is retained for legacy imports but is no longer linked.

Anna manually adds registered email addresses to the Google Calendar event she
owns. Disable See guest list, Invite others, and Modify event before inviting
guests. When the venue is confirmed, edit the event’s location and choose Send
updates. Update site-config.js and redeploy the generated email function too so
future confirmations show the venue. Google Calendar is not connected to Supabase.
Email verification and self-service cancellation are not included.
