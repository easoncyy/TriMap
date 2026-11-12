import {createHash} from 'node:crypto';
import type {Store} from '../src/lib/model.ts';
import {validateGraph} from '../src/lib/model.ts';
export const contentVersion=(s:Store)=>createHash('sha256').update(JSON.stringify([s.nodes,s.relations,s.draft])).digest('hex');
export async function maintenance(db:any){return !!(await db.prepare("SELECT value FROM settings WHERE key='content_maintenance'").first());}
export function candidate(current:Store,baseline:Store,target:Store){
 if(current.draft)throw Error('已有草稿，停止更新');
 const allowed=new Set(['app-boundary','app-scene-rag','app-specialized-training','app-sim-real','app-product-fit','app-users','infra-jitter','infra-speed-question','infra-batch-question','infra-budget-question']);
 const result=structuredClone(current);
 for(const n of target.nodes){const i=result.nodes.findIndex(x=>x.id===n.id);if(i<0){result.nodes.push(structuredClone(n));continue;}
 const old=baseline.nodes.find(x=>x.id===n.id),existing=result.nodes[i];
 if(JSON.stringify(existing)===JSON.stringify(n))continue;
 if(!old||JSON.stringify(existing)!==JSON.stringify(old)||!allowed.has(n.id)||JSON.stringify({...old,body:n.body})!==JSON.stringify(n))throw Error('未批准节点差异：'+n.id);
 result.nodes[i]={...existing,body:n.body};
 }
 for(const r of target.relations){const old=result.relations.find(x=>x.id===r.id);if(!old)result.relations.push(structuredClone(r));else if(JSON.stringify(old)!==JSON.stringify(r))throw Error('关系内容冲突：'+r.id);}
 validateGraph(result.nodes,result.relations);return result;
}
