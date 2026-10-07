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
 function render() {
  var query = $('search').value.toLowerCase().trim();
  var shown = guests.filter(function(g) { return [g.name,g.email,g.companion_name,g.companion_email].join(' ').toLowerCase().includes(query); });
  $('guests').replaceChildren();
  shown.forEach(function(g) {
   var row = document.createElement('tr');
   [g.name,g.email,g.bringing_someone ? g.companion_name || 'Yes' : '—',g.companion_email || '—',g.interested_in_speaking ? 'Yes' : '—',new Date(g.registered_at).toLocaleString('en-GB',{timeZone:'Europe/Berlin'})].forEach(function(value) {
    var cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
   });
   $('guests').appendChild(row);
  });
  var companions = guests.filter(function(g){ return g.bringing_someone; }).length;
  $('summary').textContent = guests.length + ' RSVPs · ' + companions + ' RSVPs with companions · ' + guests.filter(function(g){return g.interested_in_speaking;}).length + ' interested in speaking';
  $('results').textContent = shown.length + ' of ' + guests.length + ' RSVPs shown · Times in Munich. Companion fields may contain multiple guests; the RSVP count is not the door headcount.';
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
  var rows = [['Name','Email','Bringing someone','Companion(s)','Companion email(s)','Speaker interest','Registered at (UTC)']].concat(guests.map(function(g) {return [g.name,g.email,g.bringing_someone?'Yes':'No',g.companion_name,g.companion_email,g.interested_in_speaking?'Yes':'No',g.registered_at];}));
  var blob = new Blob(['\uFEFF' + rows.map(function(row){return row.map(cell).join(',');}).join('\r\n')],{type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob); var link = document.createElement('a'); link.href = url; link.download = 'elab-rsvps-'+new Date().toISOString().slice(0,10)+'.csv'; link.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
 });
})();
