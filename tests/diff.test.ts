import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphChanges} from '../src/lib/diff.ts';
const node={id:'a',title:'A',kind:'概念',lens:'domain' as const,summary:'',body:'',sources:[],status:'待核实' as const,x:0,y:0};
test('publication review describes added, changed and removed content',()=>{
 const before={nodes:[node,{...node,id:'removed',title:'Old'}],relations:[]};
 const after={nodes:[{...node,title:'Updated'},{...node,id:'new',title:'New'}],relations:[{id:'edge',source:'a',target:'new',label:'依赖',reason:'Evidence'}]};
 assert.deepEqual(graphChanges(before,after),['修改节点：Updated','新增节点：New','移除节点：Old','新增关系：依赖']);
});
test('unchanged publications have no fabricated differences',()=>{
 const graph={nodes:[node],relations:[]};assert.deepEqual(graphChanges(graph,structuredClone(graph)),[]);
});
