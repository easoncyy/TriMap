import type {Store} from '../src/lib/model.ts';
import {validateGraph} from '../src/lib/model.ts';
export function mergePublishedContent(current:Store,incoming:Pick<Store,'nodes'|'relations'>){
 const nodes=incoming.nodes.filter(n=>!current.nodes.some(old=>old.id===n.id));
 const ids=new Set([...current.nodes,...nodes].map(n=>n.id));
 const relations=incoming.relations.filter(r=>!current.relations.some(old=>old.id===r.id)&&ids.has(r.source)&&ids.has(r.target));
 if(!nodes.length&&!relations.length)return {state:current,addedNodes:0,addedRelations:0};
 const state=structuredClone(current);
 state.revisions.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),reason:'同步已合并的仓库知识卡片（仅补充缺失 ID）',changes:[`新增 ${nodes.length} 个节点、${relations.length} 条关系`],nodes:structuredClone(current.nodes),relations:structuredClone(current.relations)});
 state.nodes.push(...structuredClone(nodes));state.relations.push(...structuredClone(relations));validateGraph(state.nodes,state.relations);
 if(state.draft){const draftIds=new Set(state.draft.nodes.map(n=>n.id));state.draft.nodes.push(...structuredClone(nodes.filter(n=>!draftIds.has(n.id))));const all=new Set(state.draft.nodes.map(n=>n.id));state.draft.relations.push(...structuredClone(relations.filter(r=>!state.draft!.relations.some(old=>old.id===r.id)&&all.has(r.source)&&all.has(r.target))));validateGraph(state.draft.nodes,state.draft.relations);}
 return {state,addedNodes:nodes.length,addedRelations:relations.length};
}
