export const statuses = ['Not Started','In Progress','Blocked','Completed'];
export const priorities = ['Critical','High','Normal','Low'];
export function filterTasks(tasks, filters) {
 const q=(filters.search||'').toLowerCase();
 return tasks.filter(t => (!filters.category||t.category_id===filters.category) && (!filters.owner||t.assignees.includes(filters.owner)) && (!filters.status||t.status===filters.status) && (!filters.priority||t.priority===filters.priority) && (!q||`${t.title} ${t.notes}`.toLowerCase().includes(q)));
}
export function progress(tasks) {const done=tasks.filter(t=>t.status==='Completed').length; return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};}
