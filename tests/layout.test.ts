import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balancedLayout} from '../src/lib/layout.ts';
const nodes=['root','a','b','c','isolated'].map(id=>({id,title:id,lens:'domain' as const,kind:'概念',summary:'',body:'',sources:[],status:'待核实' as const,x:0,y:0}));
const edges=[{id:'1',source:'root',target:'a',label:'',reason:''},{id:'2',source:'root',target:'b',label:'',reason:''},{id:'3',source:'a',target:'c',label:'',reason:''}];
test('layout is stable, layered, complete and non-overlapping',()=>{const l=balancedLayout(nodes,edges,'root');assert.deepEqual(l,balancedLayout(nodes,edges,'root'));assert.equal(Object.keys(l.prisms).length,5);assert.ok(l.prisms.a.x>l.prisms.root.x);assert.ok(l.prisms.c.x>l.prisms.a.x);for(const a of nodes)for(const b of nodes)if(a.id!==b.id)assert.ok(Math.abs(l.prisms[a.id].x-l.prisms[b.id].x)>=240||Math.abs(l.prisms[a.id].y-l.prisms[b.id].y)>=220);});
test('mirrors create an actual bend and avoid knowledge bodies',()=>{const l=balancedLayout(nodes,edges,'root');for(const e of edges){const a=l.prisms[e.source],b=l.prisms[e.target],m=l.mirrors[e.id];assert.ok(Math.abs((b.x-a.x)*(m.y+38-a.y-80)-(b.y-a.y)*(m.x+38-a.x-100))>100);for(const n of Object.values(l.prisms))assert.ok(!(m.x<n.x+200&&m.x+76>n.x&&m.y<n.y+190&&m.y+100>n.y));}});
