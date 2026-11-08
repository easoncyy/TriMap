export type Lens = 'domain' | 'ecology' | 'cognition';
export type KnowledgeNode = { id:string; title:string; kind:string; lens:Lens; summary:string; body:string; sources:string[]; status:'待核实'|'已核实'; x:number; y:number };
export type Relation = {id:string; source:string; target:string; label:string; reason:string};
export type Feedback = {id:string; target:string; targetTitle?:string; category?:string; suggestion?:string; draftOnly?:boolean; text:string; author:string; createdAt:string; status:'待处理'|'已回应'; response:string};
export type Revision = {id:string; date:string; reason:string; nodes:KnowledgeNode[]; relations:Relation[]; changes?:string[]};
export type Store = {nodes:KnowledgeNode[]; relations:Relation[]; draft:{nodes:KnowledgeNode[];relations:Relation[]}|null; feedback:Feedback[]; revisions:Revision[]};
export type AtlasMeta={id:string;title:string;description:string;ownerName:string;isPublic:boolean;official:boolean;canEdit:boolean;owned:boolean;updatedAt:string};
export const lenses:Record<Lens,{name:string;en:string;color:string;question:string}> = {
 domain:{name:'领域地图',en:'DOMAIN',color:'#9a86ff',question:'它是什么，又如何实现？'},
 ecology:{name:'生态地图',en:'ECOSYSTEM',color:'#5cdbbd',question:'谁在推动，它们如何连接？'},
 cognition:{name:'认知地图',en:'COGNITION',color:'#ffbd73',question:'依据什么，我们如何判断？'}
};
export function validateGraph(nodes:KnowledgeNode[],relations:Relation[]) {
 if(!Array.isArray(nodes)||!Array.isArray(relations)||nodes.length>1000||relations.length>5000) throw Error('图谱格式或规模不合法');
 const ids=new Set<string>();
 for(const n of nodes){if(!n.id||ids.has(n.id)||!n.title?.trim()||!['domain','ecology','cognition'].includes(n.lens)||!['待核实','已核实'].includes(n.status)||!Array.isArray(n.sources)||!n.sources.every(s=>typeof s==='string')||typeof n.body!=='string'||typeof n.summary!=='string'||typeof n.kind!=='string'||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('节点字段不合法或 ID 重复');ids.add(n.id);}
 for(const n of nodes)for(const source of n.sources)if(/^https?:\/\//i.test(source)){try{new URL(source);}catch{throw Error('来源链接无效');}}
 const edgeIds=new Set<string>();
 for(const e of relations){if(!e.id||edgeIds.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||e.source===e.target||!e.label?.trim()||typeof e.reason!=='string')throw Error('关系必须连接两个不同的现有节点，并填写含义');edgeIds.add(e.id);}
}
