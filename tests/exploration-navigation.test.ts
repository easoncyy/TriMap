import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locateCamera,restoreCamera} from '../src/lib/exploration-navigation.ts';
const object={x:800,y:900,width:120,height:120};
const safe={x:64,y:16,width:240,height:300};
test('navigation brings an offscreen prism and a screen-sized label into a narrow safe region',()=>{
 const v=locateCamera({x:0,y:0,zoom:.8},object,safe);
 const cx=(object.x+60)*v.zoom+v.x,cy=(object.y+60)*v.zoom+v.y;
 assert.ok(cx-104>=safe.x&&cx+104<=safe.x+safe.width);
 assert.ok(cy-60*v.zoom-8>=safe.y&&cy+60*v.zoom+64<=safe.y+safe.height);
 assert.equal(v.zoom,.8);
});
test('repeated explicit navigation does not move an already readable target',()=>{
 const v=locateCamera({x:0,y:0,zoom:.15},object,safe);
 assert.equal(v.zoom,.65);
 assert.strictEqual(locateCamera(v,object,safe),v);
});
test('return restores the same world center after panel dimensions change',()=>{
 const snapshot={viewport:{x:-120,y:60,zoom:1.1},width:800,height:600};
 const v=restoreCamera(snapshot,390,330);
 assert.equal((390/2-v.x)/v.zoom,(800/2+120)/1.1);
 assert.equal((330/2-v.y)/v.zoom,(600/2-60)/1.1);
 assert.equal(v.zoom,1.1);
});
test('short screens reduce scale to leave label space and restore can retain overview scale',()=>{
 const v=locateCamera({x:0,y:0,zoom:1.8},object,{...safe,height:160});
 assert.ok(v.zoom<=.7&&v.zoom>0);
 const overview=locateCamera({x:0,y:0,zoom:.2},object,safe,true);
 assert.equal(overview.zoom,.2);
});
