import {config} from './config.js';
import {statuses, priorities, filterTasks, progress} from './model.mjs';
const $=id=>document.getElementById(id);
let session=null, generation=0, refreshing=null, state={categories:[],people:[],tasks:[]}, selected=null, loading=false;
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function options(id,values){for(const value of values){const o=node('option',value);o.value=value;$(id).append(o);}}
options('status',statuses);options('edit-status',statuses);options('priority',priorities);options('edit-priority',priorities);
function clear(){state={categories:[],people:[],tasks:[]};selected=null;$('tasks').replaceChildren();$('summary').replaceChildren();$('title').textContent='';$('tagline').textContent='';$('editor').close();for(const id of ['edit-title','acceptance','edit-message'])$(id).textContent='';$('edit-owners').replaceChildren();$('edit-notes').value='';for(const id of ['category','owner'])while($(id).options.length>1)$(id).remove(1);$('workspace').hidden=true;}
function signedOut(){generation++;session=null;clear();$('signout').hidden=true;$('login').hidden=false;}
async function request(path,{body,method='GET',authenticated=true}={}){
 const requestGeneration=generation;
 if(authenticated){if(!session)throw Error('Please sign in.');if(session.expires_at<Date.now()+60000){
 if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},authenticated:false}).finally(()=>{refreshing=null;});
 const refreshed=await refreshing;if(generation!==requestGeneration)throw Error('Signed out.');setSession(refreshed);
 }}
 const response=await fetch(config.url+path,{method,cache:'no-store',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${session.access_token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok){if(response.status===401&&authenticated)signedOut();if(data?.message?.includes('edit_conflict'))throw Error('Another teammate changed this task. Close this window, refresh, and apply your changes again.');throw Error(response.status===403?'Your account does not have team access.':(data?.msg||data?.message||'The request failed. Please try again.'));}return data;
}
function setSession(value){session={...value,expires_at:Date.now()+value.expires_in*1000};}
async function load(){if(loading||!session||$('editor').open)return;loading=true;const loadGeneration=generation;
 try{const [member,categories,people,tasks,workspace]=await Promise.all(['/rest/v1/recovery_members?select=user_id','/rest/v1/recovery_categories?select=*&order=position','/rest/v1/recovery_people?select=*&order=name','/rest/v1/recovery_tasks?select=*&order=position','/rest/v1/recovery_workspace?select=*'].map(p=>request(p)));
 if(loadGeneration!==generation)return;
 if(!member.length)throw Error('Your account does not have team access. Ask the workspace administrator for an invitation.');
 state={categories,people,tasks};$('login').hidden=true;$('workspace').hidden=false;$('signout').hidden=false;$('title').textContent=workspace[0]?.title||'Team checklist';$('tagline').textContent=workspace[0]?.tagline||'';$('message').textContent='';
 for(const [id,items] of [['category',categories.map(c=>({id:c.id,label:c.title}))],['owner',people.map(p=>({id:p.name,label:p.name}))]]){const old=$(id).value;while($(id).options.length>1)$(id).remove(1);for(const item of items){const o=node('option',item.label);o.value=item.id;$(id).append(o);}$(id).value=old;}
 render();$('sync').textContent=`Shared data updated ${new Date().toLocaleTimeString()}. Refreshes every 20 seconds.`;
 }catch(error){if(loadGeneration!==generation)return;clear();$('message').textContent=error.message;$('sync').textContent='Could not refresh. Changes are not being synchronized.';}finally{loading=false;}}
function render(){const all=progress(state.tasks);$('summary').replaceChildren(...[`${all.done} / ${all.total} completed`,`${all.percent}% overall progress`,`${state.tasks.filter(t=>t.status==='Blocked').length} blocked`].map(x=>node('strong',x,'card')));
 const filters=Object.fromEntries(['search','category','owner','status','priority'].map(k=>[k,$(k).value]));const visible=filterTasks(state.tasks,filters);$('tasks').replaceChildren();
 for(const category of state.categories){const tasks=visible.filter(t=>t.category_id===category.id);if(!tasks.length)continue;const section=node('section',undefined,'card workstream');section.append(node('h2',category.title));const p=progress(state.tasks.filter(t=>t.category_id===category.id));section.append(node('p',`Workstream owner: ${category.owners.join(' / ')} · ${p.done}/${p.total} completed`,'muted'));const meter=node('progress');meter.max=100;meter.value=p.percent;meter.setAttribute('aria-label',`${category.title} progress`);section.append(meter);
 for(const task of tasks){const row=node('article',undefined,'task');const info=node('div');info.append(node('strong',task.title),node('p',`${task.assignees.join(' / ')||'Unassigned'} · ${task.priority} · Due ${task.due_date||'not set'}`,'muted'));if(task.notes)info.append(node('p',task.notes,'notes'));const badge=node('span',task.status,'badge');const edit=node('button','Update');edit.setAttribute('aria-label',`Update ${task.title}`);edit.onclick=()=>openTask(task);row.append(info,badge,edit);section.append(row);}$('tasks').append(section);}
 if(!visible.length)$('tasks').append(node('p','No tasks match these filters.'));
}
function openTask(task){selected=task;$('edit-title').textContent=task.title;$('acceptance').textContent=`Done when: ${task.acceptance}`;$('edit-owners').replaceChildren();options('edit-owners',state.people.map(p=>p.name));for(const o of $('edit-owners').options)o.selected=task.assignees.includes(o.value);$('edit-status').value=task.status;$('edit-priority').value=task.priority;$('edit-due').value=task.due_date||'';$('edit-notes').value=task.notes;$('edit-message').textContent='';$('editor').showModal();}
$('email-form').onsubmit=async e=>{e.preventDefault();if(!config.url||!config.publishableKey){$('message').textContent='This workspace is awaiting secure connection setup. Sign-in is not yet available.';return;}const button=e.submitter;button.disabled=true;try{await request('/auth/v1/otp',{method:'POST',body:{email:$('email').value.trim(),create_user:false},authenticated:false});$('code-form').hidden=false;$('message').textContent='If your address is invited, a sign-in code will arrive by email.';}catch{$('message').textContent='Unable to send a code. Check your invitation or try again later.';}finally{button.disabled=false;}};
$('code-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{setSession(await request('/auth/v1/verify',{method:'POST',body:{email:$('email').value.trim(),token:$('code').value.trim(),type:'email'},authenticated:false}));$('code').value='';await load();}catch(error){$('message').textContent=error.message;}finally{e.submitter.disabled=false;}};
$('edit-form').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{await request('/rest/v1/rpc/recovery_update_task',{method:'POST',body:{task_id:selected.id,expected_version:selected.version,new_assignees:Array.from($('edit-owners').selectedOptions,o=>o.value),new_status:$('edit-status').value,new_priority:$('edit-priority').value,new_due_date:$('edit-due').value||null,new_notes:$('edit-notes').value}});$('editor').close();await load();}catch(error){$('edit-message').textContent=error.message;}finally{$('save').disabled=false;}};
$('cancel').onclick=()=>$('editor').close();$('refresh').onclick=()=>load();for(const id of ['search','category','owner','status','priority'])$(id).addEventListener('input',render);
$('signout').onclick=async()=>{try{await request('/auth/v1/logout',{method:'POST'});}catch{}finally{signedOut();$('message').textContent='Signed out.';}};
setInterval(()=>{if(session&&!$('editor').open&&document.visibilityState==='visible')load();},20000);
if(!config.url||!config.publishableKey)$('message').textContent='Secure workspace setup is pending. No team data is publicly available.';
