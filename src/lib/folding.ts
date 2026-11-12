import type {KnowledgeNode,Relation} from './model.ts';
/** Two-hop initial view. Opening a frontier mirror reveals only its next node. */
export function foldedView(nodes:KnowledgeNode[],edges:Relation[],root:string,overrides:Record<string,boolean>={},limit=2){
 const ids=new Set(nodes.map(n=>n.id)),depth=new Map<string,number>();const adjacency=new Map(nodes.map(n=>[n.id,[] as Relation[]]));
 for(const e of edges)if(ids.has(e.source)&&ids.has(e.target)){adjacency.get(e.source)!.push(e);adjacency.get(e.target)!.push(e);}
 if(ids.has(root))depth.set(root,0);const queue=[...depth.keys()];
 for(let i=0;i<queue.length;i++){const at=queue[i],d=depth.get(at)!;for(const e of adjacency.get(at)||[]){if(overrides[e.id]===false||d>=limit&&overrides[e.id]!==true)continue;const next=e.source===at?e.target:e.source;if(!depth.has(next)){depth.set(next,d+1);queue.push(next);}}}
 const shown=nodes.filter(n=>depth.has(n.id));const visibleEdges=edges.filter(e=>depth.has(e.source)&&depth.has(e.target)&&overrides[e.id]!==false);
 const frontier=edges.flatMap(e=>{const a=depth.has(e.source),b=depth.has(e.target);if(a===b&&!(a&&overrides[e.id]===false))return [];return [{edge:e,source:a?e.source:e.target,target:a?e.target:e.source}];});
 return {nodes:shown,edges:visibleEdges,frontier,depth};
}
