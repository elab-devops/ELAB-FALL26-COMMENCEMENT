function escapeHTML(value) {
  const entities = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

function confirmationMessage(guest, event) {
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
    text: `Hi ${guest.name},\n\nYou’re on the list for ${event.title}.\n${date} (Munich time)\n${event.location}\n\n${companion}\n${closing}\n\nYour calendar invitation will follow.\n\nSee you there,\nELAB`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:auto;padding:32px 16px;line-height:1.6"><p style="letter-spacing:3px;font-size:13px">ELAB FALL 2026</p><h1 style="font-weight:400">You’re on the list.</h1><p>Hi ${escapeHTML(guest.name)},</p><p>We’ve saved your RSVP for ${escapeHTML(event.title)}.</p><p>${escapeHTML(date)} (Munich time)<br>${escapeHTML(event.location)}</p>${companion ? `<p>${escapeHTML(companion)}</p>` : ''}<p>${closing}</p><p>Your calendar invitation will follow.</p><p>See you there,<br>ELAB</p></div>`
  };
}

if (typeof module !== 'undefined') module.exports = { confirmationMessage };
