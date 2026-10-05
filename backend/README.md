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

Optional Gmail confirmations with a Google Calendar button and calendar attachment
are prepared in [EMAIL_SETUP.md](EMAIL_SETUP.md). They require deploying the
Supabase Edge Function and running the queue and schedule SQL; pushing website
files alone does not activate emails.

## Calendar and event details

Event times are defined in `site-config.js`. The current end time is provisionally 23:00 Berlin time. Generate the downloadable calendar after changing those details:

```sh
node scripts/generate-calendar.js
```

Google opens a prefilled calendar event. Apple/iCloud and Outlook import `event.ics`. These are calendar copies: deleting one is not an RSVP cancellation, and later location changes do not automatically update imported copies. Send location updates to the collected guest emails. Email confirmations require the separate setup above. Email verification and self-service cancellation are not included.
