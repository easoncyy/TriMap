import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fullTurn,projectOrbit} from '../src/lib/orbit.ts';

test('the released layout is the zero-angle view and the light stays fixed',()=>{
 const pivot={x:160,y:240};
 for(const a of [0,.8,3,fullTurn])assert.deepEqual(projectOrbit(pivot,pivot,a),{...pivot,scale:1,depth:0});
 for(const a of [0,fullTurn]){
  const p=projectOrbit({x:870,y:1340},pivot,a);
  assert.ok(Math.hypot(p.x-870,p.y-1340)<1e-8);
  assert.ok(Math.abs(p.scale-1)<1e-12);
 }
});

test('near crystals grow and rotating a dragged point back recovers its layout coordinates',()=>{
 const pivot={x:-55,y:-91};
 const near=projectOrbit({x:1200,y:-91},pivot,Math.PI/2);
 const far=projectOrbit({x:1200,y:-91},pivot,-Math.PI/2);
 assert.ok(near.scale>far.scale&&near.depth>far.depth);
 for(const angle of [.4,2.8,5.1])for(const point of [{x:-1133,y:485},{x:389,y:11003}]){
  const saved=projectOrbit(point,pivot,-angle),displayed=projectOrbit(saved,pivot,angle);
  assert.ok(Math.hypot(point.x-displayed.x,point.y-displayed.y)<1e-8);
 }
});
