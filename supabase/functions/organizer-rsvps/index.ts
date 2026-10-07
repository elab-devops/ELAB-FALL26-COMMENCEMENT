const encoder = new TextEncoder();
const origin = 'https://elab-devops.github.io';
const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json'};
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), {status, headers}); }
async function digest(value: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
function equal(a: Uint8Array, b: Uint8Array) { let mismatch = a.length ^ b.length; for (let i=0;i<Math.max(a.length,b.length);i++) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0); return mismatch === 0; }
async function rpc(name: string, params = {}) {
 const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const result = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`, {method:'POST', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(params)});
 if (!result.ok) throw new Error('Database unavailable');
 return await result.json();
}
Deno.serve(async (request: Request) => {
 if (request.method === 'OPTIONS') return new Response(null,{headers});
 if (request.method !== 'POST') return response({error:'Method not allowed'},405);
 if (request.headers.get('origin') && request.headers.get('origin') !== origin) return response({error:'Forbidden'},403);
 try {
  const password = Deno.env.get('ORGANIZER_PASSWORD');
  if (!password || password.length < 16) return response({error:'Organizer access is not configured yet.'},503);
  if (Number(request.headers.get('content-length') || 0) > 4096) return response({error:'Request too large'},413);
  const raw = await request.text(); if (raw.length > 4096) return response({error:'Request too large'},413);
  const body = JSON.parse(raw);
  const key = await crypto.subtle.importKey('raw',encoder.encode('organizer-session:'+password),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  if (body.action === 'login') {
   const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
   const hash = Array.from(await digest(ip),v=>v.toString(16).padStart(2,'0')).join('');
   if (!await rpc('organizer_login_allowed',{attempt_key:hash})) return response({error:'Too many attempts. Try again in 15 minutes.'},429);
   if (typeof body.password !== 'string' || !equal(await digest(body.password),await digest(password))) return response({error:'Incorrect password.'},401);
   const payload = String(Date.now()+2*60*60*1000)+'.'+crypto.randomUUID();
   const signature = new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)));
   return response({token:payload+'.'+btoa(String.fromCharCode(...signature))});
  }
  const token = request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  const parts = token.split('.');
  if(parts.length !== 3 || !/^\d+$/.test(parts[0]) || Number(parts[0]) <= Date.now() || Number(parts[0]) > Date.now()+2*60*60*1000) return response({error:'Please sign in again.'},401);
  let valid = false;
  try { valid = await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(parts[2]),c=>c.charCodeAt(0)),encoder.encode(parts.slice(0,2).join('.'))); } catch { /* Invalid token */ }
  if (!valid) return response({error:'Please sign in again.'},401);
  if(body.action !== 'list') return response({error:'Unknown action'},400);
  return response({guests:await rpc('organizer_rsvp_list')});
 } catch { return response({error:'Unable to load organizer data. Please try again.'},503); }
});
