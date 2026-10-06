const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { confirmationMessage, organizerMessage } = require('../backend/email-message');
const config = { window: {} };
vm.runInNewContext(fs.readFileSync('site-config.js', 'utf8'), config);
const event = config.window.ELAB_CONFIG.event;
const guest = { email: 'guest@example.com', name: '<img src=x>', bringing_someone: true,
  companion_name: 'Alex & Sam', lease_id: 'lease' };

test('email escapes names and promises a separate invitation without calendar copies', () => {
  const message = confirmationMessage(guest, event);
  assert.ok(message.html.includes('&lt;img src=x&gt;'));
  assert.ok(!message.html.includes('<img src=x>'));
  assert.ok(message.text.includes('7PM'));
  assert.ok(message.text.includes('SAT, 17 OCT 2026, 7PM, MUC'));
  assert.ok(!message.text.includes('Berlin time'));
  assert.equal(message.to.address, guest.email);
  assert.equal(message.from.address, 'anna.papanakli@tum-ai.com');
  assert.equal(message.attachments, undefined);
  assert.ok(message.text.includes('Your calendar invitation will follow.'));
  assert.ok(message.html.includes('Your calendar invitation will follow.'));
  assert.ok(!message.html.includes('calendar.google.com'));
  assert.ok(!message.text.includes('.ics'));
  assert.ok(message.text.includes('2–3 stories'));
  assert.ok(message.html.includes('Want to shape the evening?'));
  assert.equal(message.replyTo, 'anna.papanakli@tum-ai.com');
  assert.ok(message.html.includes('ELAB FALL 2026</td>'));
  assert.ok(message.html.includes('SAT, 17 OCT 2026, 7PM, MUC</td>'));
  assert.ok(message.html.includes('You’re on the list.</h1>'));
});

function worker(sendMail, notifications = []) {
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
      return { data: name === 'claim_confirmation_emails' ? [guest] : name === 'claim_organizer_notifications' ? notifications : null, error: null };
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
  assert.deepEqual(await response.json(), { sent: 1, failed: 0, organizerSent: 0, organizerFailed: 0, organizerQueueReady: true });
  assert.equal(calls[1].args.delivered, true);
  assert.equal(calls[1].args.delivery_lease, 'lease');
});

test('SMTP failures leave the registration queued for retry', async () => {
  const { handler, calls } = worker(async () => { throw { code: 'ETIMEDOUT' }; });
  const response = await handler(new Request('https://example.com', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }
  }));
  assert.deepEqual(await response.json(), { sent: 0, failed: 1, organizerSent: 0, organizerFailed: 0, organizerQueueReady: true });
  assert.equal(calls[1].args.delivered, false);
});


test('confirmation uses the requested copy with a personalized greeting', () => {
  const message = confirmationMessage({ ...guest, name: 'Anna' }, event);
  assert.equal(message.text, "ELAB FALL 2026 | SAT, 17 OCT 2026, 7PM, MUC\n\nHi Anna,\n\nyou're in. See you at commencement.\n\nYour calendar invitation will follow.\n\nWant to shape the evening? We have room for 2–3 stories. Reply to this email with a few words about what you’d like to share.\n\nSee you there,\nELAB");
});


test('organizer notification is private, escaped, and includes invite details', () => {
  const message = organizerMessage({ ...guest, companion_email: 'alex@example.com, sam@example.com', interested_in_speaking: true });
  assert.equal(message.to.address, 'anna.papanakli@tum-ai.com');
  assert.equal(message.replyTo.address, guest.email);
  assert.ok(message.text.includes('alex@example.com, sam@example.com'));
  assert.ok(message.text.includes('Yes — interested in sharing a story'));
  assert.ok(!message.html.includes('<img src=x>'));
  assert.equal(message.cc, undefined);
  assert.equal(message.attachments, undefined);
});

test('organizer delivery retries independently without resending guest confirmation', async () => {
  const { handler, calls } = worker(async message => {
    if (message.to.address === 'anna.papanakli@tum-ai.com') throw { code: 'ETIMEDOUT' };
    return { accepted: [guest.email] };
  }, [{ ...guest, companion_email: null, interested_in_speaking: false }]);
  const response = await handler(new Request('https://example.com', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }
  }));
  const result = await response.json();
  assert.equal(result.sent, 1);
  assert.equal(result.organizerFailed, 1);
  assert.equal(calls.find(call => call.name === 'finish_confirmation_email').args.delivered, true);
  assert.equal(calls.find(call => call.name === 'finish_organizer_notification').args.delivered, false);
});
