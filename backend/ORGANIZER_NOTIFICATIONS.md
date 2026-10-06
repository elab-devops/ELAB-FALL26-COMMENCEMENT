# Notify Anna of new RSVPs

Each future RSVP queues a private email to anna.papanakli@tum-ai.com. It includes
the guest's name/email, companion names and optional email addresses, and speaking
interest if that feature's database migration has been applied. Reply goes to the
registering guest. Add the addresses to the Google Calendar event manually.

## Activate

1. Run backend/organizer-notifications.sql in Supabase SQL Editor.
2. Replace the existing send-rsvp-confirmation function's index.ts with the generated
   supabase/functions/send-rsvp-confirmation/index.ts and deploy it. Keep Verify JWT
   off; the function checks EMAIL_WORKER_TOKEN. Existing SMTP secrets and the
   scheduled job are reused; no new credentials or schedule are required.
3. Run backend/reset-test-rsvp.sql to remove only ppnkl123@gmail.com's test registration
   and its email delivery records. This does not remove a Google Calendar guest;
   remove that guest from the event separately if you want to test a fresh invitation.
4. Submit a new RSVP using that address. Check both the guest inbox and Anna's
   company inbox, including spam, within roughly a minute.

Do not run the older email-queue.sql again to configure these notifications.
The organizer notification has its own trigger, so guest confirmation and organizer
delivery are independent. Repeated submissions do not create more emails.
SMTP failures retry every ten minutes, up to five attempts. A crash after Gmail
accepts a message but before recording delivery can still cause a duplicate.
Existing RSVPs are not emailed to Anna retrospectively.

## Monitor

```sql
select email, sent_at, attempts, next_attempt_at, last_error
from elab_private.organizer_notifications
order by next_attempt_at desc;
```

After fixing a delivery problem, retry one unsent notification:

```sql
update elab_private.organizer_notifications
set attempts = 0, next_attempt_at = now(), lease_id = null
where email = 'REPLACE_WITH_GUEST_EMAIL' and sent_at is null;
```

Guest confirmation emails retain the ELAB header and compact event details.
They do not attach an independent calendar file. The guest should accept the
separate organizer-sent calendar invitation to receive later location updates.
