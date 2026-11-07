import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph} from '../src/lib/model.ts';
const a={id:'a',title:'A',kind:'概念',lens:'domain' as const,summary:'',body:'',sources:[],status:'待核实' as const,x:0,y:0};
test('rejects dangling relationships before publishing',()=>{assert.throws(()=>validateGraph([a],[{id:'r',source:'a',target:'missing',label:'依赖',reason:''}]));});
test('rejects duplicate identities',()=>{assert.throws(()=>validateGraph([a,a],[]));});
test('accepts relationships across map dimensions',()=>{assert.doesNotThrow(()=>validateGraph([a,{...a,id:'b',lens:'ecology'}],[{id:'r',source:'a',target:'b',label:'采用',reason:'依据'}]));});
