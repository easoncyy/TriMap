import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterKnowledge} from '../src/lib/graph-filter.ts';
import type {KnowledgeNode,Relation} from '../src/lib/model.ts';
const node=(id:string,title:string,kind='概念'):KnowledgeNode=>({id,title,kind,lens:'domain',summary:'',body:'',sources:[],status:'待核实',x:0,y:0});
const nodes=[node('root','光源'),node('focus','当前焦点'),node('a','视觉感知','能力'),node('b','LIBERO','资源')];
const relations:Relation[]=[{id:'r',source:'focus',target:'a',label:'关联',reason:'待核实'}];
const base={query:'',kind:'全部类型',root:'root',focus:'focus',expanded:false};
test('zero results retain context without counting it as a match',()=>{
 const result=filterKnowledge(nodes,relations,{...base,query:' no such knowledge '});
 assert.equal(result.matches.length,0);assert.deepEqual(result.anchors.map(n=>n.id),['root','focus']);
 assert.deepEqual(result.visible.map(n=>n.id),['root','focus']);
});
test('matching anchors are counted once, query is trimmed and case insensitive',()=>{
 const result=filterKnowledge(nodes,relations,{...base,query:' libero ',focus:'b'});
 assert.deepEqual(result.matches.map(n=>n.id),['b']);assert.deepEqual(result.anchors.map(n=>n.id),['root']);
 assert.equal(result.visible.length,2);
});
test('type filtering and neighborhood scope use actual relations and do not mutate knowledge',()=>{
 const before=JSON.stringify({nodes,relations});
 const result=filterKnowledge(nodes,relations,{...base,kind:'能力',expanded:true});
 assert.deepEqual(result.matches.map(n=>n.id),['a']);assert.deepEqual(result.anchors.map(n=>n.id),['root','focus']);
 assert.equal(JSON.stringify({nodes,relations}),before);
 assert.equal(filterKnowledge(nodes,relations,{...base,query:'LIBERO',expanded:true}).matches.length,0);
});
test('empty queries restore all nodes; a missing focus does not fabricate an anchor',()=>{
 assert.equal(filterKnowledge(nodes,relations,{...base,query:'  '}).visible.length,4);
 assert.deepEqual(filterKnowledge(nodes,relations,{...base,query:'missing',root:'gone',focus:'gone'}).visible,[]);
});
