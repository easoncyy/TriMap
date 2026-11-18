import type {KnowledgeNode,Relation} from './model';

/** Presentation only: matching knowledge and retained context are distinct sets. */
export function filterKnowledge(nodes:KnowledgeNode[],relations:Relation[],options:{query:string;kind:string;root:string;focus:string;expanded:boolean}){
 const {root,focus,expanded,kind}=options;
 const query=options.query.trim().toLocaleLowerCase();
 const neighbors=new Set(relations.filter(e=>e.source===focus||e.target===focus).flatMap(e=>[e.source,e.target]));
 const scope=nodes.filter(n=>!expanded||n.id===root||n.id===focus||neighbors.has(n.id));
 const matches=scope.filter(n=>(kind==='全部类型'||n.kind===kind)&&(!query||`${n.title} ${n.summary} ${n.kind}`.toLocaleLowerCase().includes(query)));
 const ids=new Set(matches.map(n=>n.id));
 const filtering=!!query||kind!=='全部类型';
 const anchors=filtering?scope.filter(n=>(n.id===root||n.id===focus)&&!ids.has(n.id)):[];
 return {matches,anchors,filtering,visible:scope.filter(n=>ids.has(n.id)||anchors.some(a=>a.id===n.id))};
}
