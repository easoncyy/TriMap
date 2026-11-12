import {test} from 'node:test';import assert from 'node:assert/strict';import {candidate,contentVersion,maintenance} from './release-safety.ts';
const node={id:'app-boundary',title:'test',lens:'domain' as const,kind:'test',summary:'',body:'old',sources:[],status:'待核实' as const,x:0,y:0};
const base={nodes:[node],relations:[],draft:null,feedback:[],revisions:[]};
test('candidate permits approved bodies, preserves other data and refuses unknown conflicts or drafts',()=>{
 const target={...base,nodes:[{...node,body:'approved'},{...node,id:'new'}]};const updated=candidate(base,base,target);assert.equal(updated.nodes.length,2);assert.equal(updated.nodes[0].body,'approved');assert.deepEqual(base.nodes,[node]);
 assert.throws(()=>candidate({...base,nodes:[{...node,body:'user edit'}]},base,target));assert.throws(()=>candidate({...base,draft:{nodes:[],relations:[]}},base,target));
 assert.throws(()=>candidate(base,base,{...base,nodes:[{...node,title:'unauthorized'}]}));
 assert.notEqual(contentVersion(base),contentVersion(updated));assert.equal(contentVersion(base),contentVersion({...base,feedback:[]}));
});
test('maintenance checks only settings, without invoking initialization',async()=>{const queries:string[]=[];assert.equal(await maintenance({prepare:(q:string)=>{queries.push(q);return {first:async()=>({value:'locked'})}}}),true);assert.ok(queries[0].startsWith('SELECT'));});
