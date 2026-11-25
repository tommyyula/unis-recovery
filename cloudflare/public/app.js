import {statuses, priorities, filterTasks, progress} from './model.mjs';
const $=id=>document.getElementById(id);
let session=true, generation=0, state={categories:[],people:[],tasks:[]}, selected=null, loading=false;
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function options(id,values){for(const value of values){const o=node('option',value);o.value=value;$(id).append(o);}}
options('status',statuses);options('edit-status',statuses);options('priority',priorities);options('edit-priority',priorities);
function clear(){state={categories:[],people:[],tasks:[]};selected=null;$('tasks').replaceChildren();$('summary').replaceChildren();$('title').textContent='';$('tagline').textContent='';$('editor').close();for(const id of ['edit-title','acceptance','edit-message'])$(id).textContent='';$('edit-owners').replaceChildren();$('edit-notes').value='';for(const id of ['category','owner'])while($(id).options.length>1)$(id).remove(1);$('workspace').hidden=true;}
function signedOut(){generation++;session=null;clear();$('signout').hidden=true;$('login').hidden=false;}
async function request(path,{body,method='GET'}={}){
 const response=await fetch(path,{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Workspace-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});
 if(response.redirected||!response.headers.get('Content-Type')?.includes('application/json'))throw Error('Your sign-in expired. Use company email sign-in to continue.');
 const data=await response.json();if(!response.ok)throw Error(data.message||'Unable to connect. Please try again.');return data;
}
async function load(){if(loading||!session||$('editor').open)return;loading=true;const loadGeneration=generation;
 try{const {categories,people,tasks,workspace}=await request('/api/workspace');
 if(loadGeneration!==generation)return;
 state={categories,people,tasks};$('login').hidden=true;$('workspace').hidden=false;$('signout').hidden=false;$('title').textContent=workspace?.title||'Team checklist';$('tagline').textContent=workspace?.tagline||'';$('message').textContent='';
 for(const [id,items] of [['category',categories.map(c=>({id:c.id,label:c.title}))],['owner',people.map(p=>({id:p.name,label:p.name}))]]){const old=$(id).value;while($(id).options.length>1)$(id).remove(1);for(const item of items){const o=node('option',item.label);o.value=item.id;$(id).append(o);}$(id).value=old;}
 render();$('sync').textContent=`Shared data updated ${new Date().toLocaleTimeString()}. Refreshes every 20 seconds.`;
 }catch(error){if(loadGeneration!==generation)return;clear();$('login').hidden=false;$('message').textContent=error.message;$('sync').textContent='Could not refresh. Changes are not being synchronized.';}finally{loading=false;}}
function render(){const all=progress(state.tasks);$('summary').replaceChildren(...[`${all.done} / ${all.total} completed`,`${all.percent}% overall progress`,`${state.tasks.filter(t=>t.status==='Blocked').length} blocked`].map(x=>node('strong',x,'card')));
 const filters=Object.fromEntries(['search','category','owner','status','priority'].map(k=>[k,$(k).value]));const visible=filterTasks(state.tasks,filters);$('tasks').replaceChildren();
 for(const category of state.categories){const tasks=visible.filter(t=>t.category_id===category.id);if(!tasks.length)continue;const section=node('section',undefined,'card workstream');section.append(node('h2',category.title));const p=progress(state.tasks.filter(t=>t.category_id===category.id));section.append(node('p',`Workstream owner: ${category.owners.join(' / ')} · ${p.done}/${p.total} completed`,'muted'));const meter=node('progress');meter.max=100;meter.value=p.percent;meter.setAttribute('aria-label',`${category.title} progress`);section.append(meter);
 for(const task of tasks){const row=node('article',undefined,'task');const info=node('div');info.append(node('strong',task.title),node('p',`${task.assignees.join(' / ')||'Unassigned'} · ${task.priority} · Due ${task.due_date||'not set'}`,'muted'));if(task.notes)info.append(node('p',task.notes,'notes'));const badge=node('span',task.status,'badge');const edit=node('button','Update');edit.setAttribute('aria-label',`Update ${task.title}`);edit.onclick=()=>openTask(task);row.append(info,badge,edit);section.append(row);}$('tasks').append(section);}
 if(!visible.length)$('tasks').append(node('p','No tasks match these filters.'));
}
function openTask(task){selected=task;$('edit-title').textContent=task.title;$('acceptance').textContent=`Done when: ${task.acceptance}`;$('edit-owners').replaceChildren();options('edit-owners',state.people.map(p=>p.name));for(const o of $('edit-owners').options)o.selected=task.assignees.includes(o.value);$('edit-status').value=task.status;$('edit-priority').value=task.priority;$('edit-due').value=task.due_date||'';$('edit-notes').value=task.notes;$('edit-message').textContent='';$('editor').showModal();}
$('edit-form').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{await request(`/api/tasks/${selected.id}`,{method:'PUT',body:{version:selected.version,assignees:Array.from($('edit-owners').selectedOptions,o=>o.value),status:$('edit-status').value,priority:$('edit-priority').value,due_date:$('edit-due').value||null,notes:$('edit-notes').value}});$('editor').close();await load();}catch(error){$('edit-message').textContent=error.message;}finally{$('save').disabled=false;}};
$('cancel').onclick=()=>$('editor').close();$('refresh').onclick=()=>load();for(const id of ['search','category','owner','status','priority'])$(id).addEventListener('input',render);
$('signout').onclick=()=>{signedOut();location.assign('/cdn-cgi/access/logout');};
setInterval(()=>{if(session&&!$('editor').open&&document.visibilityState==='visible')load();},20000);
load();
