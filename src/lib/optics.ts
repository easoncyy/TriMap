import type {KnowledgeNode,Lens,Relation} from './model';
export type Point={x:number;y:number};
export type Mirror={id:string;edgeId:string;position:Point;angle:number;view:string;targetId?:string};
export function mirrorAngle(from:Point,mirror:Point,to:Point){return (Math.atan2(mirror.y-from.y,mirror.x-from.x)+Math.atan2(to.y-mirror.y,to.x-mirror.x))*90/Math.PI;}
export type OpticalMode='dispersion'|'refraction';
/** Relations retain their semantic direction; light follows connectivity from the source. */
export function lightPath(nodes:KnowledgeNode[],edges:Relation[],root:string,target:string){
 const ids=new Set(nodes.map(n=>n.id));if(!ids.has(root)||!ids.has(target))return null;
 const queue=[root],previous=new Map<string,{node:string;edge:string}>(),seen=new Set([root]);
 for(let i=0;i<queue.length;i++){
  const at=queue[i];if(at===target)break;
  for(const edge of edges){const next=edge.source===at?edge.target:edge.target===at?edge.source:null;if(next&&ids.has(next)&&!seen.has(next)){seen.add(next);previous.set(next,{node:at,edge:edge.id});queue.push(next);}}
 }
 if(!seen.has(target))return null;
 const path=[target],relations:string[]=[];let at=target;
 while(at!==root){const p=previous.get(at)!;path.unshift(p.node);relations.unshift(p.edge);at=p.node;}
 return {nodes:path,edges:relations};
}
export function opticalView(nodes:KnowledgeNode[],edges:Relation[],lens:Lens,root:string,focus:string,mode:OpticalMode){
 const local=nodes.filter(n=>n.lens===lens),localIds=new Set(local.map(n=>n.id));
 const localEdges=edges.filter(e=>localIds.has(e.source)&&localIds.has(e.target));
 if(mode==='dispersion')return {nodes:local,edges:localEdges,path:lightPath(local,localEdges,root,focus)};
 // Prefer an entirely local upstream route; only cross dimensions if the focus already did so.
 const path=lightPath(local,localEdges,root,focus)||lightPath(nodes,edges,root,focus);
 const selected=nodes.find(n=>n.id===focus);
 const cross=edges.filter(e=>(e.source===focus||e.target===focus)&&nodes.find(n=>n.id===(e.source===focus?e.target:e.source))?.lens!==selected?.lens);
 const ids=new Set([root,focus,...(path?.nodes||[]),...cross.flatMap(e=>[e.source,e.target])]);
 const allowed=new Set([...(path?.edges||[]),...cross.map(e=>e.id)]);
 return {nodes:nodes.filter(n=>ids.has(n.id)),edges:edges.filter(e=>allowed.has(e.id)),path};
}
export function reflectedDirection(from:Point,mirror:Point,angle:number){
 const dx=mirror.x-from.x,dy=mirror.y-from.y,length=Math.hypot(dx,dy)||1;
 const incoming={x:dx/length,y:dy/length};const normal=(angle+90)*Math.PI/180;
 const nx=Math.cos(normal),ny=Math.sin(normal),dot=incoming.x*nx+incoming.y*ny;
 return {x:incoming.x-2*dot*nx,y:incoming.y-2*dot*ny};
}
export function aimTarget(from:Point,mirror:Point,angle:number,candidates:{id:string;position:Point}[]){
 const direction=reflectedDirection(from,mirror,angle);
 return candidates.map(n=>{const dx=n.position.x-mirror.x,dy=n.position.y-mirror.y,len=Math.hypot(dx,dy);return {...n,score:len>35?(dx*direction.x+dy*direction.y)/len:-1};}).filter(n=>n.score>0.94).sort((a,b)=>b.score-a.score)[0]?.id||null;
}
