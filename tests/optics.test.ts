import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightPath,opticalView,reflectedDirection,aimTarget,mirrorAngle} from '../src/lib/optics.ts';
const n=(id:string,lens:'domain'|'ecology'='domain')=>({id,lens,title:id,kind:'概念',summary:'',body:'',sources:[],status:'待核实' as const,x:0,y:0});
const nodes=[n('root'),n('a'),n('b'),n('other'),n('cross','ecology'),n('isolated')];
const e=(id:string,source:string,target:string)=>({id,source,target,label:'关联',reason:'依据'});
const edges=[e('1','a','root'),e('2','a','b'),e('3','root','other'),e('4','b','cross'),e('5','cross','other')];
test('dispersion only shows the chosen dimension',()=>{const view=opticalView(nodes,edges,'domain','root','b','dispersion');assert.ok(!view.nodes.some(n=>n.id==='cross'));assert.ok(!view.edges.some(e=>e.id==='4'));});
test('refraction retains the upstream path and selected cross-map rays only',()=>{const view=opticalView(nodes,edges,'domain','root','b','refraction');assert.deepEqual(view.path?.nodes,['root','a','b']);assert.deepEqual(view.edges.map(e=>e.id),['1','2','4']);assert.ok(!view.nodes.some(n=>n.id==='other'));});
test('unconnected nodes never get invented upstream rays',()=>{assert.equal(lightPath(nodes,edges,'root','isolated'),null);});
test('cycles do not prevent finding a path',()=>{assert.ok(lightPath(nodes,[...edges,e('cycle','b','root')],'root','cross'));});
test('mirror angle changes the reflected direction and aim target',()=>{const from={x:0,y:0},mirror={x:100,y:0};const d=reflectedDirection(from,mirror,45);assert.ok(Math.abs(d.x)<1e-9);assert.ok(d.y>0.99);assert.equal(aimTarget(from,mirror,45,[{id:'down',position:{x:100,y:200}},{id:'up',position:{x:100,y:-200}}]),'down');});
test('automatic mirror angle reflects exactly towards the selected target after moving',()=>{
 const from={x:20,y:40},target={x:400,y:120};
 for(const m of [{x:130,y:70},{x:210,y:310},{x:500,y:50}]){
  const d=reflectedDirection(from,m,mirrorAngle(from,m,target));const dx=target.x-m.x,dy=target.y-m.y,len=Math.hypot(dx,dy);
  assert.ok(Math.abs(d.x-dx/len)<1e-9);assert.ok(Math.abs(d.y-dy/len)<1e-9);
 }
});
