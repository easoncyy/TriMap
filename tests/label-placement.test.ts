import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeLabel,crosses,overlaps} from '../src/lib/label-placement.ts';
test('labels avoid a beam through their background and other labels',()=>{
 const box={x:0,y:0,width:150,height:36},obstacles=[{x:-10,y:40,width:180,height:80}];
 const lines=[{a:{x:-500,y:18},b:{x:500,y:18}}];
 const result=placeLabel(box,obstacles,lines);assert.equal(crosses(result,lines[0]),false);assert.equal(overlaps(result,obstacles[0]),false);
 const next=placeLabel(box,[...obstacles,result],lines);assert.equal(overlaps(result,next),false);assert.equal(crosses(next,lines[0]),false);
});
test('segment collision handles vertical, diagonal and zero length rays',()=>{
 const box={x:0,y:0,width:100,height:30};
 assert.ok(crosses(box,{a:{x:50,y:-30},b:{x:50,y:100}}));
 assert.ok(crosses(box,{a:{x:-10,y:-10},b:{x:110,y:40}}));
 assert.equal(crosses(box,{a:{x:200,y:0},b:{x:200,y:0}}),false);
});

test('bounded labels stay inside the viewport even at an edge',async()=>{
 const {placeLabelWithin}=await import('../src/lib/label-placement.ts');
 const bounds={x:12,y:12,width:300,height:180};
 const result=placeLabelWithin({x:290,y:-20,width:130,height:40},[],[],bounds)!;
 assert.ok(result.x>=12&&result.x+result.width<=312);
 assert.ok(result.y>=12&&result.y+result.height<=192);
});
test('bounded labels yield instead of escaping a saturated viewport',async()=>{
 const {placeLabelWithin}=await import('../src/lib/label-placement.ts');
 const bounds={x:0,y:0,width:150,height:100};
 assert.equal(placeLabelWithin({x:0,y:0,width:80,height:30},[bounds],[],bounds),null);
 assert.equal(placeLabelWithin({x:0,y:0,width:180,height:30},[],[],bounds),null);
});
test('a grouped label avoids another label and stays near its owner',async()=>{
 const {placeLabelWithin}=await import('../src/lib/label-placement.ts');
 const initial={x:150,y:150,width:100,height:42};
 const result=placeLabelWithin(initial,[initial],[],{x:0,y:0,width:600,height:400})!;
 assert.equal(overlaps(result,initial),false);
 assert.ok(Math.hypot(result.x-initial.x,result.y-initial.y)<=144);
});

test('edge clamping must not teleport a label far away from its owner',async()=>{
 const {placeLabelWithin}=await import('../src/lib/label-placement.ts');
 assert.equal(placeLabelWithin({x:-300,y:20,width:90,height:30},[],[],{x:0,y:0,width:320,height:300},64),null);
});
test('optional label yields when it would be attributed to a nearer neighbouring object',async()=>{
 const {placeLabelWithin}=await import('../src/lib/label-placement.ts');
 const box={x:160,y:60,width:80,height:28},owner={x:0,y:0,width:20,height:20},peer={x:180,y:10,width:20,height:20};
 const bounds={x:0,y:0,width:320,height:240};
 assert.equal(placeLabelWithin(box,[],[],bounds,0,{owner,peers:[peer]}),null);
 assert.ok(placeLabelWithin(box,[],[],bounds,0,{owner:peer,peers:[owner]}));
});
