const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { confirmationMessage } = require('../backend/email-message');
const config = { window: {} };
vm.runInNewContext(fs.readFileSync('site-config.js', 'utf8'), config);
const event = config.window.ELAB_CONFIG.event;
const guest = { email: 'guest@example.com', name: '<img src=x>', bringing_someone: true,
  companion_name: 'Alex & Sam', lease_id: 'lease' };

test('email escapes names and promises a separate invitation without calendar copies', () => {
  const message = confirmationMessage(guest, event);
  assert.ok(message.html.includes('&lt;img src=x&gt;'));
  assert.ok(!message.html.includes('<img src=x>'));
  assert.ok(message.html.includes('Alex &amp; Sam'));
  assert.ok(message.text.includes('19:00'));
  assert.ok(message.text.includes('Munich time'));
  assert.ok(!message.text.includes('Berlin time'));
  assert.equal(message.to.address, guest.email);
  assert.equal(message.from.address, 'anna.papanakli@tum-ai.com');
  assert.equal(message.attachments, undefined);
  assert.ok(message.text.includes('Your calendar invitation will follow.'));
  assert.ok(message.html.includes('Your calendar invitation will follow.'));
  assert.ok(!message.html.includes('calendar.google.com'));
  assert.ok(!message.text.includes('.ics'));
});

function worker(sendMail) {
  let handler;
  const calls = [];
  const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/send-rsvp-confirmation/index.ts', 'utf8')
    .replace(/^import .*;\n/gm, ''));
  vm.runInNewContext(source, {
    Response, Intl, console: { error() {} },
    Deno: { serve(fn) { handler = fn; }, env: { get(key) { return {
      EMAIL_WORKER_TOKEN: 'private-token', SMTP_USERNAME: 'anna.papanakli@tum-ai.com',
      SMTP_PASSWORD: 'app-password', SUPABASE_SERVICE_ROLE_KEY: 'admin', SUPABASE_URL: 'https://example.com'
    }[key]; } } },
    createClient() { return { async rpc(name, args) {
      calls.push({ name, args });
      return { data: name === 'claim_confirmation_emails' ? [guest] : null, error: null };
    } }; },
    nodemailer: { createTransport() { return { sendMail, close() {} }; } }
  });
  return { handler, calls };
}

test('worker rejects public callers before accessing registrations', async () => {
  const { handler, calls } = worker(() => assert.fail('Must not send'));
  const response = await handler(new Request('https://example.com', { method: 'POST' }));
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('worker records Gmail acceptance using the claimed lease', async () => {
  const { handler, calls } = worker(async message => {
    assert.equal(message.to.address, guest.email);
    return { accepted: [guest.email] };
  });
  const response = await handler(new Request('https://example.com', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }
  }));
  assert.deepEqual(await response.json(), { sent: 1, failed: 0 });
  assert.equal(calls[1].args.delivered, true);
  assert.equal(calls[1].args.delivery_lease, 'lease');
});

test('SMTP failures leave the registration queued for retry', async () => {
  const { handler, calls } = worker(async () => { throw { code: 'ETIMEDOUT' }; });
  const response = await handler(new Request('https://example.com', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }
  }));
  assert.deepEqual(await response.json(), { sent: 0, failed: 1 });
  assert.equal(calls[1].args.delivered, false);
});
