function escapeHTML(value) {
  const entities = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

function confirmationMessage(guest, event) {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(event.start));
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(event.start));
  const details = `${date}, ${time}, ${event.location.replace(/ — /g, ' - ')}. Your calendar invitation will follow.`;
  const opening = "you're in. See you at commencement.";
  const speaking = 'Want to shape the evening? We have room for 2–3 stories. Reply to this email with a few words about what you’d like to share.';
  return {
    from: { name: 'ELAB', address: 'anna.papanakli@tum-ai.com' },
    replyTo: 'anna.papanakli@tum-ai.com',
    to: { address: guest.email },
    subject: 'You’re on the list — ELAB Fall 2026',
    text: `Hi ${guest.name},\n\n${opening}\n\n${details}\n\n${speaking}\n\nSee you there,\nELAB`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:auto;padding:32px 16px;line-height:1.6"><p>Hi ${escapeHTML(guest.name)},</p><p>${escapeHTML(opening)}</p><p>${escapeHTML(details)}</p><p>${escapeHTML(speaking)}</p><p>See you there,<br>ELAB</p></div>`
  };
}

if (typeof module !== 'undefined') module.exports = { confirmationMessage };
