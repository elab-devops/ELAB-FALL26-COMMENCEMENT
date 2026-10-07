const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { countdown, calendarLinks, calendarFile, register } = require('../party.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('site-config.js', 'utf8'), context);
const event = context.window.ELAB_CONFIG.event;

test('countdown targets 19:00 Munich time and stops at zero', () => {
  assert.equal(Date.parse(event.start), Date.parse('2026-10-17T17:00:00Z'));
  assert.deepEqual(countdown(event.start, Date.parse('2026-10-16T15:58:57Z')), [1, 1, 1, 3]);
  assert.deepEqual(countdown(event.start, Date.parse('2026-10-18T00:00:00Z')), [0, 0, 0, 0]);
});

test('calendar links and downloaded file agree on the evening and local time', () => {
  const links = calendarLinks(event);
  const google = new URL(links.google);
  assert.equal(google.searchParams.get('text'), 'ELAB Commencement Evening');
  assert.equal(google.searchParams.get('dates'), '20261017T170000Z/20261017T220000Z');
  assert.equal(google.searchParams.get('ctz'), 'Europe/Berlin');
  assert.ok(google.searchParams.get('details').includes('Location coming soon, see you there.'));
  const file = calendarFile(event);
  assert.equal(file, fs.readFileSync('event.ics', 'utf8'));
  assert.match(file, /DTSTART:20261017T170000Z\r\n/);
  assert.match(file, /DTEND:20261017T220000Z\r\n/);
  assert.match(file, /TRANSP:OPAQUE/);
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('calendar fields cannot inject additional ICS properties', () => {
  const file = calendarFile({ ...event, title: 'Evening\nATTENDEE:intruder@example.com; Test, event',
    description: 'é'.repeat(100) });
  assert.ok(!file.split('\r\n').some(line => line.startsWith('ATTENDEE:')));
  assert.ok(file.includes('SUMMARY:Evening\\nATTENDEE:'));
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('RSVP sends normalized details through a POST body with the public key', async () => {
  let request;
  await register({ supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'sb_publishable_example' },
    { email: ' Guest@Example.com ', name: ' Anna ' }, async (url, options) => {
      request = { url, options }; return { ok: true };
    });
  assert.equal(request.url, 'https://project.supabase.co/rest/v1/rpc/register_party_rsvp');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { guest_email: 'guest@example.com', guest_name: 'Anna',
    bringing_someone: false, interested_in_speaking: false, invited_by: '', companion_name: '', companion_email: '' });
  assert.equal(request.options.headers.apikey, 'sb_publishable_example');
});

test('plus-one details are normalized and only sent when y is selected', async () => {
  const config = { supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'key' };
  const details = { email: 'guest@example.com', name: 'Anna', bringingSomeone: true,
    companionName: ' Alex ', companionEmail: ' Alex@Example.com ' };
  let saved;
  const fetcher = async (_, options) => { saved = JSON.parse(options.body); return { ok: true }; };
  await register(config, details, fetcher);
  assert.equal(saved.companion_name, 'Alex');
  assert.equal(saved.companion_email, 'alex@example.com');
  await register(config, { ...details, companionEmail: '' }, fetcher);
  assert.equal(saved.companion_email, '');
  await register(config, { ...details, bringingSomeone: false }, fetcher);
  assert.equal(saved.companion_name, '');
  assert.equal(saved.companion_email, '');
});

test('missing configuration, invalid transport, and backend failure never count as success', async () => {
  const details = { email: 'guest@example.com', name: 'Anna' };
  await assert.rejects(register({}, details, () => { throw new Error('Must not call network'); }), /not-configured/);
  await assert.rejects(register({ supabaseUrl: 'http://project.supabase.co', supabasePublishableKey: 'key' }, details, () => {}), /invalid-config/);
  await assert.rejects(register({ supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'key' }, details,
    async () => ({ ok: false, status: 500 })), /registration-failed/);
  await assert.rejects(register({ supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'key' }, details,
    async () => { throw new Error('Network unavailable'); }), /Network unavailable/);
});

test('multiple companion emails are normalized and deduplicated', async () => {
  let saved;
  await register({ supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'key' },
    { email: 'guest@example.com', name: 'Anna', bringingSomeone: true,
      companionName: 'Alex, Sam', companionEmail: ' Alex@Example.com, sam@example.com, ALEX@example.com ' },
    async (_, options) => { saved = JSON.parse(options.body); return { ok: true }; });
  assert.equal(saved.companion_email, 'alex@example.com, sam@example.com');
});


test('speaking interest is optional and is sent only as a boolean', async () => {
  const config = { supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'key' };
  const details = { email: 'guest@example.com', name: 'Anna' };
  let saved;
  const fetcher = async (_, options) => { saved = JSON.parse(options.body); return { ok: true }; };
  await register(config, details, fetcher);
  assert.equal(saved.interested_in_speaking, false);
  await register(config, { ...details, interestedInSpeaking: true }, fetcher);
  assert.equal(saved.interested_in_speaking, true);
});

test('inviter is optional and normalized in the RSVP request', async () => {
 let saved;
 const config = {supabaseUrl:'https://project.supabase.co',supabasePublishableKey:'key'};
 const fetcher = async (_,options) => {saved=JSON.parse(options.body); return {ok:true};};
 await register(config,{email:'guest@example.com',name:'Guest',invitedBy:'  Anna  '},fetcher);
 assert.equal(saved.invited_by,'Anna');
 await register(config,{email:'guest@example.com',name:'Guest'},fetcher);
 assert.equal(saved.invited_by,'');
});
