import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extendPositions} from '../src/lib/layout.ts';

test('folding and re-expanding preserves automatic, dragged and hidden positions',()=>{
 const initial={root:{x:0,y:0},a:{x:1100,y:0},hidden:{x:2200,y:0}};
 const closed=extendPositions({root:{x:900,y:900}},initial);
 assert.deepEqual(closed,initial);
 const reopened=extendPositions({root:{x:-900,y:900},a:{x:0,y:0},hidden:{x:0,y:0}},closed);
 assert.deepEqual(reopened,initial);
});
test('new branches avoid saved positions without relocating existing branches',()=>{
 const saved={root:{x:0,y:0},manual:{x:700,y:0}};
 const next=extendPositions({root:{x:50,y:50},newA:{x:0,y:0},newB:{x:0,y:0}},saved);
 assert.deepEqual(next.root,saved.root);assert.deepEqual(next.manual,saved.manual);
 const items=Object.values(next);
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)assert.ok(Math.abs(items[i].x-items[j].x)>=620||Math.abs(items[i].y-items[j].y)>=360);
 assert.deepEqual(extendPositions({newB:{x:-1,y:-1}},next),next);
});
