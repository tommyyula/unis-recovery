import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterTasks,progress} from '../public/model.mjs';
const tasks=[{category_id:'a',assignees:['A','B'],status:'Completed',priority:'High',title:'First',notes:''},{category_id:'b',assignees:['B'],status:'Blocked',priority:'Critical',title:'Second',notes:'Waiting for approval'}];
test('combines filters and matches shared assignments',()=>{assert.equal(filterTasks(tasks,{owner:'B'}).length,2);assert.equal(filterTasks(tasks,{owner:'B',status:'Blocked',search:'APPROVAL',priority:'Critical',category:'b'}).length,1);assert.equal(filterTasks(tasks,{category:'a',status:'Blocked'}).length,0);});
test('progress uses actual completed tasks and handles empty list',()=>{assert.deepEqual(progress(tasks),{done:1,total:2,percent:50});assert.deepEqual(progress([]),{done:0,total:0,percent:0});});
