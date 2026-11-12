import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {KnowledgeNode, Relation, Store} from '../src/lib/model.ts';
import {validateGraph} from '../src/lib/model.ts';
import * as app from '../src/lib/application-content.ts';
import * as infra from '../src/lib/infra-content.ts';
import * as vision from '../src/lib/vision-content.ts';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/content-integration.json', import.meta.url), 'utf8')) as {
 baseSha:string; prHeadSha:string; documentSha256:string; approvedBodies:Record<string,string>;
 legacyStore:Store; mainStore:Store; prInfra:typeof infra;
};
const dependencies:Record<string,unknown> = {'./application-content':app,'./infra-content':infra,'./vision-content':vision};
function readSeed():Store {
 const exports:{seed?:Store}={};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/seed.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText,{exports,require:(id:string)=>{assert.ok(Object.hasOwn(dependencies,id));return dependencies[id];}},{timeout:1000});
 return structuredClone(exports.seed!);
}
const seed=readSeed();
const bodyIds=new Set(Object.keys(baseline.approvedBodies));
const infraBodyIds=new Set(['infra-jitter','infra-speed-question','infra-batch-question','infra-budget-question']);
const withoutBody=({body,...rest}:KnowledgeNode)=>rest;
const unique=(values:string[])=>assert.equal(new Set(values).size,values.length);

test('approved document: precisely six body replacements, every other application field preserved',()=>{
 assert.equal(bodyIds.size,6);
 const original=baseline.mainStore.nodes.filter(n=>n.id.startsWith('app-'));
 assert.deepEqual(app.applicationNodes.map(n=>n.id),original.map(n=>n.id));
 for(const n of original){
  const actual=app.applicationNodes.find(x=>x.id===n.id)!;
  assert.deepEqual(actual,bodyIds.has(n.id)?{...n,body:baseline.approvedBodies[n.id]}:n,n.id);
 }
 assert.deepEqual(app.applicationRelations,baseline.mainStore.relations.filter(r=>r.id.startsWith('app-')));
});
test('legacy cards and relations remain intact except the approved bodies',()=>{
 for(const n of baseline.legacyStore.nodes)assert.deepEqual(seed.nodes.find(x=>x.id===n.id),bodyIds.has(n.id)?{...n,body:baseline.approvedBodies[n.id]}:n,n.id);
 for(const r of baseline.legacyStore.relations)assert.deepEqual(seed.relations.find(x=>x.id===r.id),r,r.id);
});
test('latest main records survive, with only approved application and PR8 body changes',()=>{
 for(const n of baseline.mainStore.nodes){
  const actual=seed.nodes.find(x=>x.id===n.id)!;assert.ok(actual,n.id);
  if(bodyIds.has(n.id)||infraBodyIds.has(n.id))assert.deepEqual(withoutBody(actual),withoutBody(n),n.id);
  else assert.deepEqual(actual,n,n.id);
 }
 for(const r of baseline.mainStore.relations)assert.deepEqual(seed.relations.find(x=>x.id===r.id),r,r.id);
});
test('PR8 is preserved exactly; its delta is one node, six edges and four body edits',()=>{
 assert.deepEqual({...infra},baseline.prInfra);
 const priorNodes=baseline.mainStore.nodes.filter(n=>n.id.startsWith('infra-'));
 const priorEdges=baseline.mainStore.relations.filter(r=>r.id.startsWith('infra-rel-'));
 const nodeIds=new Set(priorNodes.map(n=>n.id)),edgeIds=new Set(priorEdges.map(r=>r.id));
 assert.deepEqual(infra.infraNodes.filter(n=>!nodeIds.has(n.id)).map(n=>n.id),['infra-async']);
 assert.deepEqual(infra.infraRelations.filter(r=>!edgeIds.has(r.id)).map(r=>r.id),[
  'infra-rel-async-core','infra-rel-async-feedback','infra-rel-async-resource',
  'infra-rel-boundary-budget','infra-rel-handover-timeout','infra-rel-evaluation-benchmark']);
 const changed=priorNodes.filter(n=>JSON.stringify(infra.infraNodes.find(x=>x.id===n.id))!==JSON.stringify(n));
 assert.deepEqual(changed.map(n=>n.id).sort(),[...infraBodyIds].sort());
 for(const n of changed)assert.deepEqual(withoutBody(infra.infraNodes.find(x=>x.id===n.id)!),withoutBody(n));
 for(const r of priorEdges)assert.deepEqual(infra.infraRelations.find(x=>x.id===r.id),r);
});
test('vision package remains byte-identical and all sixteen cards and thirty-two edges are included',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../src/lib/vision-content.ts',import.meta.url))).digest('hex'),'04c3645ed2771118683c38ab8e6d021bac03444d4240d4d2c9bd3a781d914fe3');
 assert.deepEqual(seed.nodes.filter(n=>n.id.startsWith('vision-')),vision.visionNodes);
 assert.deepEqual(seed.relations.filter(r=>r.id.startsWith('vision-rel-')),vision.visionRelations);
});
test('counts derive from actual ID unions; all endpoints, reasons and relation identities are valid',t=>{
 const expectedNodes=new Map([...baseline.mainStore.nodes,...infra.infraNodes,...vision.visionNodes].map(n=>[n.id,n]));
 const expectedEdges=new Map([...baseline.mainStore.relations,...infra.infraRelations,...vision.visionRelations].map(r=>[r.id,r]));
 assert.deepEqual(new Set(seed.nodes.map(n=>n.id)),new Set(expectedNodes.keys()));
 assert.deepEqual(new Set(seed.relations.map(r=>r.id)),new Set(expectedEdges.keys()));
 validateGraph(seed.nodes,seed.relations);unique(seed.nodes.map(n=>n.id));unique(seed.relations.map(r=>r.id));
 unique(seed.relations.map(r=>JSON.stringify([r.source,r.target])));
 for(const r of seed.relations)assert.ok(r.reason.trim(),r.id);
 t.diagnostic(JSON.stringify({nodes:seed.nodes.length,relations:seed.relations.length,
  lenses:seed.nodes.reduce((a,n)=>({...a,[n.lens]:(a[n.lens]||0)+1}),{} as Record<string,number>)}));
});
test('PR8 application bridges resolve real application nodes and preserve engineering caveats',()=>{
 for(const [id,source,target] of [
  ['infra-rel-boundary-budget','app-boundary','infra-e2e'],
  ['infra-rel-handover-timeout','app-handover','infra-jitter'],
  ['infra-rel-evaluation-benchmark','app-evaluation','infra-benchmark']]){
  const r=seed.relations.find(r=>r.id===id)!;assert.equal(r.source,source);assert.equal(r.target,target);
  assert.ok(seed.nodes.some(n=>n.id===source));assert.ok(seed.nodes.some(n=>n.id===target));assert.match(r.reason,/工程分析建议/);
 }
});
test('Infra cognitive text separates judgment, evidence, unknowns, plans and revision conditions',()=>{
 for(const n of infra.infraNodes.filter(n=>n.lens==='cognition')){
  for(const key of ['当前判断：','依据：','未知：','验证计划：','修正条件：'])assert.ok(n.body.includes(key),n.id+key);
  assert.match(n.body,/尚无本组实测结果|尚未执行本组实验|尚未给出实测结论/);
  assert.equal(n.status,'待核实');
 }
 assert.match(infra.infraNodes.find(n=>n.id==='infra-jitter')!.body,/统计量不能单独证明最坏情况上界或硬实时保证/);
 const asyncNode=infra.infraNodes.find(n=>n.id==='infra-async')!;
 assert.match(asyncNode.body,/不代表所有策略支持同一接口或本组已验证收益/);
 assert.ok(asyncNode.sources.includes('https://huggingface.co/blog/async-robot-inference'));
});
test('content imports do not alter lifecycle or accumulate records across evaluation',()=>{
 const before=JSON.stringify(dependencies);
 for(let i=0;i<5;i++)assert.deepEqual(readSeed(),seed);
 assert.equal(JSON.stringify(dependencies),before);
 assert.deepEqual({draft:seed.draft,feedback:seed.feedback,revisions:seed.revisions},{draft:null,feedback:[],revisions:[]});
});
