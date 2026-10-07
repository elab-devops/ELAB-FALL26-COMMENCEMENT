# Password-only organizer access

The organizer page is at https://elab-devops.github.io/ELAB-FALL26-COMMENCEMENT/admin/.
It displays names, emails, companions, speaking interest and RSVP times, with search
and CSV export. Counts distinguish RSVPs from RSVPs with companions because a
companion field can contain multiple people.

## Activate in Supabase

1. In SQL Editor run `backend/organizer-access.sql`.
2. Under Edge Functions → Secrets, set `ORGANIZER_PASSWORD` to a unique password
   of at least 16 characters. Do not put it in source code or this document.
3. Deploy `supabase/functions/organizer-rsvps/index.ts` as `organizer-rsvps`,
   with JWT verification disabled (the function validates organizer sessions).
   In CLI: `supabase functions deploy organizer-rsvps --project-ref cqgsiqerjbbbkphcqrki --no-verify-jwt`.
4. Open `/admin/`, sign in and confirm that the RSVP list loads.

The built-in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY Edge Function secrets
are used only server-side. Never add a service-role key to the website.
Anonymous and authenticated API roles cannot call the list or rate-limit RPCs.
The service role can. Password attempts are limited to 10 per IP per 15-minute
window in the database. IP addresses are stored as SHA-256 hashes.

Sessions are signed with an HMAC key derived from the password and expire in two
hours. The browser holds the session only in memory; refresh or closing the page
requires signing in again. Changing the password invalidates existing sessions.
Sign out clears the page and in-memory data. Downloaded CSVs remain on your
computer. CSV cells neutralize formula prefixes; the table uses textContent.

Only the production GitHub Pages origin is accepted for browser requests. CORS
is not the access control: every list request also requires a valid session.
Do not change the private schema's exposure or add public read policies.

## Invitation tracking

The Invited checkbox records whether you have sent a guest their calendar invitation.
It does not send invitations. Updates persist in Supabase and are included in CSV exports.
To enable this column on an existing installation, rerun `backend/organizer-access.sql`
(it preserves RSVPs and passwords), redeploy `organizer-rsvps`, and publish the updated
`admin/` files. Existing guests start unchecked; mark those already invited manually.

Each row also has Delete. A confirmation names the guest before permanently removing
the RSVP and its email queue records. Google Calendar invitations are unaffected.
Deletion requires a signed organizer session; anonymous API callers cannot delete.

Actual headcount sums one person per RSVP plus the editable companion count.
Initial counts split names on commas, semicolons, line breaks, ampersands or “and”;
review these counts where names are ambiguous. Deleting an RSVP removes its entire
headcount contribution. Rerun organizer-access.sql and redeploy the function for
this update; existing saved companion counts are preserved.
