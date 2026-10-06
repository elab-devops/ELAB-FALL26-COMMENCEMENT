function escapeHTML(value) {
  const entities = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

function confirmationMessage(guest, event) {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(event.start)).toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour: 'numeric', hour12: true
  }).format(new Date(event.start)).replace(/\s/g, '');
  const eventHeader = `${date}, ${time}, MUC`;
  const opening = "you're in. See you at commencement.";
  const speaking = 'Want to shape the evening? We have room for 2–3 stories. Reply to this email with a few words about what you’d like to share.';
  return {
    from: { name: 'ELAB', address: 'anna.papanakli@tum-ai.com' },
    replyTo: 'anna.papanakli@tum-ai.com',
    to: { address: guest.email },
    subject: 'You’re on the list — ELAB Fall 2026',
    text: `ELAB FALL 2026 | ${eventHeader}\n\nHi ${guest.name},\n\n${opening}\n\nYour calendar invitation will follow.\n\n${speaking}\n\nSee you there,\nELAB`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:auto;padding:32px 16px;line-height:1.6"><table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr><td style="padding:0 12px 0 0;font-size:10px;letter-spacing:2px;vertical-align:top">ELAB FALL 2026</td><td style="padding:0;font-size:10px;letter-spacing:.5px;text-align:right;vertical-align:top">${escapeHTML(eventHeader)}</td></tr></table><h1 style="font-weight:400">You’re on the list.</h1><p>Hi ${escapeHTML(guest.name)},</p><p>${escapeHTML(opening)}</p><p>Your calendar invitation will follow.</p><p>${escapeHTML(speaking)}</p><p>See you there,<br>ELAB</p></div>`
  };
}

function organizerMessage(guest) {
  const companions = guest.bringing_someone
    ? `${guest.companion_name || 'Not provided'}\nCompanion email(s): ${guest.companion_email || 'Not provided (optional)'}`
    : 'None';
  const speaking = guest.interested_in_speaking ? 'Yes — interested in sharing a story' : 'Not selected';
  return {
    from: { name: 'ELAB RSVP', address: 'anna.papanakli@tum-ai.com' },
    to: { address: 'anna.papanakli@tum-ai.com' },
    replyTo: { address: guest.email },
    subject: `New ELAB RSVP — ${guest.name.replace(/[\r\n]/g, ' ')}`,
    text: `A new guest has RSVPed.\n\nName: ${guest.name}\nEmail: ${guest.email}\n\nCompanion(s): ${companions}\n\nSpeaking interest: ${speaking}\n\nAdd their email address and any provided companion addresses to your ELAB Google Calendar event, then save and send the invitations.`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:auto;padding:32px 16px;line-height:1.6"><p style="letter-spacing:3px;font-size:13px">ELAB RSVP</p><h1 style="font-weight:400">A new guest is coming.</h1><p>${escapeHTML(guest.name)}<br>${escapeHTML(guest.email)}</p><p>Companion(s):<br>${escapeHTML(companions).replace(/\n/g, '<br>')}</p><p>Speaking interest: ${escapeHTML(speaking)}</p><p>Add their email address and any provided companion addresses to your ELAB Google Calendar event, then save and send the invitations.</p></div>`
  };
}

if (typeof module !== 'undefined') module.exports = { confirmationMessage, organizerMessage };
