// @deno-types="npm:@types/nodemailer@7"
import nodemailer from 'npm:nodemailer@9';
import { createClient } from 'npm:@supabase/supabase-js@2';

type EmailGuest = {
  email: string;
  name: string;
  bringing_someone: boolean;
  companion_name: string | null;
  lease_id: string;
};
type EventDetails = {
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  url: string;
};

/* GENERATED_MESSAGE */

Deno.serve(async (request: Request) => {
  const token = Deno.env.get('EMAIL_WORKER_TOKEN');
  if (!token || request.headers.get('Authorization') !== `Bearer ${token}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  if (username !== 'anna.papanakli@tum-ai.com' || !password) {
    return Response.json({ error: 'Email secrets are not configured' }, { status: 503 });
  }
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
  if (!adminKey) return Response.json({ error: 'Database credentials missing' }, { status: 503 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, adminKey);
  const { data: guests, error } = await db.rpc('claim_confirmation_emails');
  if (error) return Response.json({ error: 'Could not claim queued emails' }, { status: 500 });
  const smtp = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: username, pass: password.replace(/\s/g, '') },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
  let sent = 0, failed = 0;
  for (const guest of guests || []) {
    let delivered = false;
    try {
      const result = await smtp.sendMail(confirmationMessage(guest, EVENT));
      delivered = (result.accepted?.length ?? 0) > 0;
    } catch (failure) {
      // Log only error codes, never addresses, passwords, or SMTP response bodies.
      const code = typeof failure === 'object' && failure !== null && 'code' in failure
        && typeof failure.code === 'string' ? failure.code : 'unknown';
      console.error('SMTP failure', code);
    }
    const { error: finishError } = await db.rpc('finish_confirmation_email', {
      recipient_email: guest.email, delivery_lease: guest.lease_id, delivered
    });
    if (finishError) console.error('Could not record delivery status');
    if (delivered) sent++; else failed++;
  }
  smtp.close();
  return Response.json({ sent, failed });
});
