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
