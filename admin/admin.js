(function () {
 'use strict';
 var token = '', guests = [];
 var $ = function (id) { return document.getElementById(id); };
 async function request(body) {
  var config = window.ELAB_CONFIG;
  if (!config || !config.supabaseUrl) throw new Error('Organizer access is not configured yet.');
  var response = await fetch(config.supabaseUrl + '/functions/v1/organizer-rsvps', {
   method: 'POST', cache: 'no-store', headers: {'Content-Type': 'application/json', apikey: config.supabasePublishableKey, ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: JSON.stringify(body)
  });
  var data = await response.json();
  if (!response.ok) {
   if (response.status === 401 && token) signOut();
   throw new Error(data.error || 'Unable to load the guest list.');
  }
  return data;
 }
 function signOut() { token = ''; guests = []; $('guests').replaceChildren(); $('dashboard').hidden = true; $('login').hidden = false; $('password').value = ''; $('search').value = ''; $('summary').textContent = ''; }
 function companionCount(g) {
  if (Number.isInteger(g.companion_count) && g.companion_count >= 0) return g.companion_count;
  if (!g.bringing_someone) return 0;
  return Math.max(1, String(g.companion_name || '').split(/[,;\n&]|\s+and\s+/i).filter(function(name){return name.trim();}).length);
 }
 function render() {
  var query = $('search').value.toLowerCase().trim();
  var shown = guests.filter(function(g) { return [g.name,g.email,g.companion_name,g.companion_email,g.invited_by].join(' ').toLowerCase().includes(query); });
  $('guests').replaceChildren();
  shown.forEach(function(g) {
   var row = document.createElement('tr');
   [g.name,g.email,g.invited_by || '—',g.bringing_someone ? g.companion_name || 'Yes' : '—',g.companion_email || '—',g.interested_in_speaking ? 'Yes' : '—',new Date(g.registered_at).toLocaleString('en-GB',{timeZone:'Europe/Berlin'})].forEach(function(value) {
    var cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
   });
   var invitedCell = document.createElement('td');
   var checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!g.invited;
   checkbox.setAttribute('aria-label', 'Invited: ' + g.name);
   checkbox.addEventListener('change', async function() {
    var next = checkbox.checked; checkbox.disabled = true; $('status').textContent = 'Saving invitation status…';
    try { await request({action:'set_invited', email:g.email, invited:next}); g.invited = next; render(); $('status').textContent = 'Invitation status saved.'; }
    catch(error) { checkbox.checked = !!g.invited; $('status').textContent = error.message; }
    finally { checkbox.disabled = false; }
   });
   invitedCell.appendChild(checkbox); row.appendChild(invitedCell);
   var countCell = document.createElement('td'); var countInput = document.createElement('input');
   countInput.type = 'number'; countInput.min = '0'; countInput.max = '1000'; countInput.step = '1'; countInput.value = companionCount(g);
   countInput.style.width = '90px'; countInput.setAttribute('aria-label', 'Companion count: ' + g.name);
   countInput.addEventListener('change', async function() {
    var count = Number(countInput.value);
    if (!countInput.value || !Number.isInteger(count) || count < 0 || count > 1000) { countInput.value = companionCount(g); $('status').textContent = 'Enter a companion count between 0 and 1000.'; return; }
    countInput.disabled = true; $('status').textContent = 'Saving companion count…';
    try { await request({action:'set_companion_count',email:g.email,count:count}); g.companion_count = count; render(); $('status').textContent = 'Companion count saved.'; }
    catch(error) { countInput.value = companionCount(g); $('status').textContent = error.message; }
    finally { countInput.disabled = false; }
   });
   countCell.appendChild(countInput); row.appendChild(countCell);
   var actions = document.createElement('td'); var deleteButton = document.createElement('button');
   deleteButton.type = 'button'; deleteButton.textContent = 'Delete'; deleteButton.setAttribute('aria-label', 'Delete RSVP: ' + g.name);
   deleteButton.addEventListener('click', async function() {
    if (!window.confirm('Are you sure you want to delete the RSVP for ' + g.name + ' (' + g.email + ')?\n\nThis permanently removes their RSVP and invitation tracking. It does not remove any Google Calendar invitation.')) return;
    deleteButton.disabled = true; $('status').textContent = 'Deleting RSVP…';
    try { await request({action:'delete',email:g.email,confirm:true}); guests = guests.filter(function(guest){return guest.email !== g.email;}); render(); $('status').textContent = 'RSVP deleted.'; }
    catch(error) { $('status').textContent = error.message; }
    finally { deleteButton.disabled = false; }
   });
   actions.appendChild(deleteButton); row.appendChild(actions);
   $('guests').appendChild(row);
  });
  var companions = guests.filter(function(g){ return g.bringing_someone; }).length;
  $('summary').textContent = guests.length + ' RSVPs · ' + guests.reduce(function(total,g){return total + 1 + companionCount(g);},0) + ' actual headcount · ' + guests.filter(function(g){return g.invited;}).length + ' invited · ' + companions + ' RSVPs with companions · ' + guests.filter(function(g){return g.interested_in_speaking;}).length + ' interested in speaking';
  $('results').textContent = shown.length + ' of ' + guests.length + ' RSVPs shown · Times in Munich. Headcount includes each RSVP plus its companion count. Check the editable counts for names entered as free text.';
 }
 async function refresh() { var data = await request({action:'list'}); guests = data.guests; render(); $('status').textContent = guests.length ? 'Guest list updated.' : 'No RSVPs yet.'; }
 $('login').addEventListener('submit',async function(event) {
  event.preventDefault(); var button = $('login').querySelector('button'); button.disabled = true; $('status').textContent = 'Signing in…';
  try { var data = await request({action:'login',password:$('password').value}); token = data.token; $('password').value = ''; await refresh(); $('login').hidden = true; $('dashboard').hidden = false; }
  catch(error) { signOut(); $('status').textContent = error.message; }
  finally { button.disabled = false; }
 });
 $('refresh').addEventListener('click',async function() { this.disabled = true; $('status').textContent = 'Refreshing…'; try { await refresh(); } catch(error) { $('status').textContent = error.message; } finally { this.disabled = false; } });
 $('logout').addEventListener('click',function(){ signOut(); $('status').textContent = 'Signed out.'; });
 $('search').addEventListener('input',render);
 $('export').addEventListener('click',function() {
  function cell(value) { var text = String(value == null ? '' : value); if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g,'""') + '"'; }
  var rows = [['Name','Email','Who invited you','Bringing someone','Companion(s)','Companion email(s)','Speaker interest','Registered at (UTC)','Invited','Companion count']].concat(guests.map(function(g) {return [g.name,g.email,g.invited_by || '—',g.bringing_someone?'Yes':'No',g.companion_name,g.companion_email,g.interested_in_speaking?'Yes':'No',g.registered_at,g.invited?'Yes':'No',companionCount(g)];}));
  var blob = new Blob(['\uFEFF' + rows.map(function(row){return row.map(cell).join(',');}).join('\r\n')],{type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob); var link = document.createElement('a'); link.href = url; link.download = 'elab-rsvps-'+new Date().toISOString().slice(0,10)+'.csv'; link.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
 });
})();
