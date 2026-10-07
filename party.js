(function (root) {
  'use strict';

  function countdown(start, now) {
    var seconds = Math.max(0, Math.floor((Date.parse(start) - now) / 1000));
    return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
      Math.floor(seconds / 60) % 60, seconds % 60];
  }

  function stamp(date) {
    return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function calendarLinks(event) {
    var google = new URL('https://calendar.google.com/calendar/render');
    google.search = new URLSearchParams({ action: 'TEMPLATE', text: event.title,
      dates: stamp(event.start) + '/' + stamp(event.end), ctz: 'Europe/Berlin',
      location: event.location, details: event.description + '\n' + event.url });
    // An .ics file works with Apple/iCloud Calendar and Outlook, including desktop clients.
    return { google: google.href, apple: './event.ics', outlook: './event.ics' };
  }

  function escapeICS(value) {
    return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  }

  function calendarFile(event) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ELAB//Fall 2026//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:elab-fall26-commencement@elab-devops.github.io', 'DTSTAMP:20261005T000000Z',
      'DTSTART:' + stamp(event.start), 'DTEND:' + stamp(event.end),
      'SUMMARY:' + escapeICS(event.title), 'LOCATION:' + escapeICS(event.location),
      'DESCRIPTION:' + escapeICS(event.description + '\n' + event.url),
      'URL:' + event.url, 'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'];
    // RFC 5545 folding is measured in UTF-8 bytes, not JavaScript character count.
    return lines.map(function (line) {
      var chunks = [], chunk = '', bytes = 0;
      for (var character of line) {
        var size = new TextEncoder().encode(character).length;
        if (bytes + size > 75) { chunks.push(chunk); chunk = ' '; bytes = 1; }
        chunk += character; bytes += size;
      }
      chunks.push(chunk);
      return chunks.join('\r\n');
    }).join('\r\n') + '\r\n';
  }

  async function register(config, details, fetcher) {
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('not-configured');
    var url = new URL(config.supabaseUrl);
    if (url.protocol !== 'https:') throw new Error('invalid-config');
    var response = await fetcher(url.origin + '/rest/v1/rpc/register_party_rsvp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey },
      body: JSON.stringify({ guest_email: details.email.trim().toLowerCase(), guest_name: details.name.trim(),
        bringing_someone: !!details.bringingSomeone,
        interested_in_speaking: !!details.interestedInSpeaking,
        invited_by: String(details.invitedBy || '').trim(),
        companion_name: details.bringingSomeone ? details.companionName.trim() : '',
        companion_email: details.bringingSomeone ? Array.from(new Set(details.companionEmail.split(',').map(function (email) {
          return email.trim().toLowerCase();
        }))).join(', ') : '' }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('registration-failed');
  }

  function init() {
    var config = root.ELAB_CONFIG;
    var digits = document.querySelectorAll('[data-countdown]');
    function update() {
      countdown(config.event.start, Date.now()).forEach(function (number, i) {
        digits[i].textContent = String(number).padStart(2, '0');
      });
      if (Date.now() >= Date.parse(config.event.start)) clearInterval(clock);
    }
    update();
    var clock = setInterval(update, 1000);
    if (Date.now() >= Date.parse(config.event.start)) clearInterval(clock);
    document.addEventListener('visibilitychange', update);

    var form = document.getElementById('rsvp-form');
    var button = document.getElementById('rsvp-submit');
    var status = document.getElementById('rsvp-status');
    var confirmation = document.getElementById('rsvp-confirmation');
    var companionFields = document.getElementById('companion-fields');
    function updateCompanionFields() {
      var bringing = form.elements.bringingSomeone.value === 'y';
      companionFields.hidden = !bringing;
      form.elements.companionName.disabled = !bringing;
      form.elements.companionEmail.disabled = !bringing;
      form.elements.companionName.required = bringing;
    }
    form.elements.bringingSomeone.forEach(function (radio) {
      radio.addEventListener('change', updateCompanionFields);
    });
    updateCompanionFields();
    var busy = false;
    try {
      var name = new URLSearchParams(location.search).get('name') || '';
      form.elements.guestName.value = name.normalize('NFC').replace(/[^\p{L}\p{M}\s'’.-]/gu, '').trim().slice(0, 100);
    } catch (_) {}
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      button.disabled = true;
      button.textContent = 'RSVP opens soon';
      return;
    }
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (busy || !form.reportValidity()) return;
      busy = true; button.disabled = true; button.textContent = 'Saving…'; status.textContent = '';
      try {
        await register(config, { email: form.elements.email.value, name: form.elements.guestName.value,
          invitedBy: form.elements.invitedBy.value,
          bringingSomeone: form.elements.bringingSomeone.value === 'y',
          interestedInSpeaking: form.elements.interestedInSpeaking.checked,
          companionName: form.elements.companionName.value, companionEmail: form.elements.companionEmail.value }, root.fetch.bind(root));
        form.reset(); updateCompanionFields(); form.hidden = true; confirmation.hidden = false;
        document.getElementById('rsvp-confirmed-title').focus();
      } catch (_) {
        status.textContent = 'We couldn’t save your RSVP. Please try again.';
      } finally {
        busy = false; button.disabled = false; button.textContent = 'Count me in';
      }
    });
  }

  var api = { countdown: countdown, calendarLinks: calendarLinks, calendarFile: calendarFile, register: register };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
