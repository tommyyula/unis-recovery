const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'"};
const json=(value,status=200)=>Response.json(value,{status,headers:security});
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let cachedKeys={};
export async function authenticate(request,env,fetchKeys=fetch){
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'')||!env.ACCESS_AUD)throw Error('setup_pending');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>16000)throw Error('unauthorized');
 try{
 const parts=token.split('.');if(parts.length!==3)throw Error();
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
 const now=Math.floor(Date.now()/1000),issuer=`https://${env.ACCESS_TEAM_DOMAIN}`;
 if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+30||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now+30))||typeof claims.email!=='string'||!claims.sub)throw Error();
 const email=claims.email.toLowerCase();if(!/^[^@\s]+@item\.com$/.test(email))throw Error();
 let cache=cachedKeys[issuer];if(!cache||cache.until<Date.now()||!cache.keys.some(k=>k.kid===header.kid)){
  const response=await fetchKeys(`${issuer}/cdn-cgi/access/certs`);if(!response.ok)throw Error();
  const value=await response.json();if(!Array.isArray(value.keys))throw Error();cache={keys:value.keys,until:Date.now()+300000};cachedKeys[issuer]=cache;
 }
 const jwk=cache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))throw Error();
 return email;
 }catch{throw Error('unauthorized');}
}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function unpack(task){return {...task,assignees:JSON.parse(task.assignees)};}
export async function handle(request,env,fetchKeys=fetch){
 const url=new URL(request.url);
 if(url.pathname==='/health')return json({ok:true});
 if(!url.pathname.startsWith('/api/')){
  if(url.pathname==='/login')return Response.redirect(`${url.origin}/`,302);
  const result=await env.ASSETS.fetch(request);const headers=new Headers(result.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);return new Response(result.body,{status:result.status,headers});
 }
 let email;try{email=await authenticate(request,env,fetchKeys);}catch(error){return json({message:error.message==='setup_pending'?'Secure sign-in setup is pending.':'Please sign in with your invited @item.com email.'},error.message==='setup_pending'?503:401);}
 if(!env.DB)return json({message:'Shared workspace setup is pending.'},503);
 try{
 const member=await env.DB.prepare('SELECT email FROM members WHERE email=? AND enabled=1').bind(email).first();
 if(!member)return json({message:'Your account is not approved for this workspace. Ask the administrator for an invitation.'},403);
 if(url.pathname==='/api/workspace'&&request.method==='GET'){
 const results=await env.DB.batch(['SELECT * FROM workspace','SELECT * FROM categories ORDER BY position','SELECT * FROM people ORDER BY name','SELECT * FROM tasks ORDER BY position'].map(q=>env.DB.prepare(q)));
 return json({workspace:results[0].results[0],categories:results[1].results.map(c=>({...c,owners:JSON.parse(c.owners)})),people:results[2].results,tasks:results[3].results.map(unpack)});
 }
 const match=url.pathname.match(/^\/api\/tasks\/([1-9][0-9]*)$/);
 if(match&&request.method==='PUT'){
 if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Workspace-Request')!=='1'||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({message:'Request origin rejected.'},403);
 if(Number(request.headers.get('Content-Length'))>24000)return json({message:'Update is too large.'},413);
 const raw=await request.text();if(raw.length>12000)return json({message:'Update is too large.'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({message:'Invalid update.'},400);}
 if(!Number.isSafeInteger(data.version)||!Array.isArray(data.assignees)||data.assignees.length>30||new Set(data.assignees).size!==data.assignees.length||data.assignees.some(x=>typeof x!=='string')||!['Not Started','In Progress','Blocked','Completed'].includes(data.status)||!['Critical','High','Normal','Low'].includes(data.priority)||typeof data.notes!=='string'||data.notes.length>4000||!(data.due_date===null||validDate(data.due_date)))return json({message:'Check the task fields and try again.'},400);
 const people=(await env.DB.prepare('SELECT name FROM people').all()).results.map(p=>p.name);if(data.assignees.some(n=>!people.includes(n)))return json({message:'Select an existing team member.'},400);
 const saved=await env.DB.prepare("UPDATE tasks SET assignees=?,status=?,priority=?,due_date=?,notes=?,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM members WHERE email=? AND enabled=1) RETURNING *").bind(JSON.stringify(data.assignees),data.status,data.priority,data.due_date,data.notes,email,Number(match[1]),data.version,email).first();
 if(!saved)return json({message:'Another teammate changed this task, or your access changed. Close the editor and refresh before saving again.'},409);
 return json(unpack(saved));
 }
 return json({message:'Not found.'},404);
 }catch{return json({message:'Unable to complete the request. Please try again.'},500);}
}
export default {fetch:handle};
