-- Run only after deploying send-rsvp-confirmation and saving EMAIL_WORKER_TOKEN.
-- This processes up to five queued confirmations every minute.
do $$
begin
  if exists(select 1 from cron.job where jobname = 'elab-confirmation-emails') then
    perform cron.unschedule('elab-confirmation-emails');
  end if;
end;
$$;
select cron.schedule('elab-confirmation-emails', '* * * * *', $job$
  select net.http_post(
    url := 'https://cqgsiqerjbbbkphcqrki.supabase.co/functions/v1/send-rsvp-confirmation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'elab_email_worker_token'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
