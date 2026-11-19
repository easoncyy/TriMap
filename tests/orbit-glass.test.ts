import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orbitStones,type GlassAnchor} from '../src/components/optical/orbit-glass.ts';

test('moving glass keeps its measured anchor, projected size and light from the relation mirror',()=>{
 const nodes=[{id:'glass',position:{x:20,y:30},data:{orbitScale:1.5}},{id:'mirror',position:{x:90,y:-10},data:{}}];
 const anchors=new Map<string,GlassAnchor>([
  ['glass',{offset:{x:100,y:80},span:40,mirrorId:'mirror',material:{energy:1,focused:true}}],
  ['mirror',{offset:{x:38,y:38},span:76}],
 ]);
 const camera={x:-10,y:5,zoom:.5};
 assert.deepEqual(orbitStones(nodes,anchors,camera),[{id:'glass',x:35,y:45,span:30,energy:1,focused:true,light:{x:4,y:41}}]);
 anchors.delete('mirror');
 assert.equal(orbitStones(nodes,anchors,camera),null);
});
