# Gmail RSVP confirmations

The sender is ELAB <anna.papanakli@tum-ai.com>. Each new RSVP queues one email
to the registering guest (companions do not receive a separate message).
The email includes the event details, a Google Calendar button, and ELAB.ics
for Apple Calendar and Outlook. No guest login is required.

## Activate in Supabase

1. Keep SMTP_USERNAME and SMTP_PASSWORD in Edge Functions → Secrets.
   SMTP_USERNAME must be anna.papanakli@tum-ai.com; SMTP_PASSWORD is that
   account's Gmail app password. Do not configure this under Authentication:
   these are event confirmations, not account signup emails.
2. Run backend/email-queue.sql in SQL Editor. Its final result is a private
   EMAIL_WORKER_TOKEN. Copy that value directly into a secret named
   EMAIL_WORKER_TOKEN under Edge Functions → Secrets. Do not share the result.
   The SQL enables Cron and pg_net and stores the worker token in Supabase Vault.
3. Under Edge Functions, create a function via the editor named
   send-rsvp-confirmation. Replace its code with the entire generated
   supabase/functions/send-rsvp-confirmation/index.ts and deploy it.
   Turn off the function's JWT verification (sometimes labelled
   "Verify JWT with legacy secret"). The code authenticates a private worker
   token instead; it refuses requests without that token. Do not remove this check.
4. Run backend/email-schedule.sql in SQL Editor. This schedules the private
   worker every minute. Public website code and its keys stay unchanged.
5. Submit a new RSVP using an email you own. Within roughly a minute, check
   the inbox and spam folder and open the calendar attachment. Confirm it
   starts October 17 at 19:00 Munich time. Gmail acceptance is not proof of inbox delivery.

Existing registrations are not emailed automatically. To test using Anna's
already registered personal address, explicitly queue only that registration:

```sql
insert into elab_private.confirmation_emails(email)
select email from elab_private.party_rsvps
where email = 'anna.papanakli@gmail.com'
on conflict(email) do nothing;
```

## Monitor and retry

```sql
select email, sent_at, attempts, next_attempt_at, last_error
from elab_private.confirmation_emails
order by next_attempt_at desc;
```

SMTP failures retry every ten minutes, up to five attempts. A row being
processed has a lease so overlapping worker runs do not claim the same row.
Repeat RSVPs do not enqueue more confirmations. If Gmail accepts a message
but the worker crashes before recording that result, a retry can still send
a duplicate: SMTP has no exactly-once delivery guarantee.

After fixing a delivery problem, retry one unsent email:

```sql
update elab_private.confirmation_emails
set attempts = 0, next_attempt_at = now(), lease_id = null
where email = 'REPLACE_WITH_GUEST_EMAIL' and sent_at is null;
```

To pause email delivery without disabling RSVPs:

```sql
select cron.unschedule('elab-confirmation-emails');
```

Do not share full SMTP errors containing guest addresses or credentials.
Gmail sending limits apply. This setup sends calendar copies; imported events
do not update automatically when the venue changes. Send a venue update later.

## Maintaining event details

Event details come from site-config.js. After a change run:

```sh
node scripts/generate-calendar.js
node scripts/generate-email-worker.js
node --test tests/party.test.js tests/email.test.js
```

Redeploy the generated Edge Function as well as publishing the website.
GitHub Pages deployment does not deploy Supabase functions or SQL changes.
For CLI deployment, supabase/config.toml sets the required verify_jwt=false.

## VS Code diagnostics

Install the recommended Deno extension (`denoland.vscode-deno`). The workspace
settings enable Deno only for supabase/functions so it understands npm: imports
and the Deno runtime. The website and generator scripts continue using Node.
Check the generated function with:

```sh
npx --yes deno check --config supabase/functions/deno.json supabase/functions/send-rsvp-confirmation/index.ts
```
