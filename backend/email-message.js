function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function confirmationMessage(guest, event, googleCalendarUrl, calendar) {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(event.start));
  const companion = guest.bringing_someone
    ? `We've also noted your guest(s): ${guest.companion_name}.` : '';
  const closing = 'The exact location is coming soon. We’ll email you with the details.';
  return {
    from: { name: 'ELAB', address: 'anna.papanakli@tum-ai.com' },
    replyTo: 'anna.papanakli@tum-ai.com',
    to: { address: guest.email },
    subject: 'You’re on the list — ELAB Fall 2026',
    text: `Hi ${guest.name},\n\nYou’re on the list for ${event.title}.\n${date} (Munich time)\n${event.location}\n\n${companion}\n${closing}\n\nAdd to Google Calendar: ${googleCalendarUrl}\nFor Apple Calendar or Outlook, open the attached ELAB.ics file.\n\nSee you there,\nELAB`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:auto;padding:32px 16px;line-height:1.6"><p style="letter-spacing:3px;font-size:13px">ELAB FALL 2026</p><h1 style="font-weight:400">You’re on the list.</h1><p>Hi ${escapeHTML(guest.name)},</p><p>We’ve saved your RSVP for ${escapeHTML(event.title)}.</p><p>${escapeHTML(date)} (Munich time)<br>${escapeHTML(event.location)}</p>${companion ? `<p>${escapeHTML(companion)}</p>` : ''}<p>${closing}</p><p><a style="display:inline-block;padding:12px 20px;background:#000;color:#fff;text-decoration:none" href="${escapeHTML(googleCalendarUrl)}">Add to Google Calendar</a></p><p style="font-size:13px;color:#666">For Apple Calendar or Outlook, open the attached ELAB.ics file.</p><p>See you there,<br>ELAB</p></div>`,
    attachments: [{ filename: 'ELAB.ics', content: calendar, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }]
  };
}

if (typeof module !== 'undefined') module.exports = { confirmationMessage };
