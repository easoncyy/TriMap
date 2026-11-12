import type {KnowledgeNode,Relation} from './model';
import type {Point} from './optics';
import {crosses,overlaps,type Box} from './label-placement.ts';
export const LAYOUT_VERSION=2;
export function primaryTree(nodes:KnowledgeNode[],edges:Relation[],root:string){
 const ids=new Set(nodes.map(n=>n.id)),children=new Map(nodes.map(n=>[n.id,[] as string[]])),parent=new Map<string,string>(),treeEdges=new Set<string>(),depth=new Map<string,number>();
 if(!ids.has(root))return {children,parent,treeEdges,depth};
 const adjacency=new Map(nodes.map(n=>[n.id,[] as Relation[]]));
 for(const e of edges)if(ids.has(e.source)&&ids.has(e.target)){adjacency.get(e.source)!.push(e);adjacency.get(e.target)!.push(e);}
 const queue=[root];depth.set(root,0);
 for(let i=0;i<queue.length;i++){const at=queue[i];for(const e of [...adjacency.get(at)!].sort((a,b)=>a.id.localeCompare(b.id))){const next=e.source===at?e.target:e.source;if(depth.has(next))continue;depth.set(next,depth.get(at)!+1);parent.set(next,at);children.get(at)!.push(next);treeEdges.add(e.id);queue.push(next);}}
 return {children,parent,treeEdges,depth};
}
const labelBox=(p:Point):Box=>({x:p.x-170,y:p.y+132,width:540,height:175});
const mirrorLabel=(p:Point):Box=>({x:p.x-190,y:p.y+78,width:460,height:150});
function intersection(a:Point,b:Point,c:Point,d:Point){const cross=(u:Point,v:Point)=>u.x*v.y-u.y*v.x;const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},v={x:c.x-a.x,y:c.y-a.y},den=cross(r,s);if(Math.abs(den)<.001)return false;const t=cross(v,s)/den,u=cross(v,r)/den;return t>.01&&t<.99&&u>.01&&u<.99;}
export function routeMirrors(positions:Record<string,Point>,edges:Relation[]){
 const result:Record<string,Point>={},occupied:Box[]=[],rays:{a:Point;b:Point}[]=[];
 const bodies=Object.values(positions).map(p=>({x:p.x+25,y:p.y,width:150,height:130})),labels=Object.values(positions).map(labelBox);
 for(const edge of [...edges].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!positions[edge.source]||!positions[edge.target])continue;
  const a={x:positions[edge.source].x+100,y:positions[edge.source].y+80},b={x:positions[edge.target].x+100,y:positions[edge.target].y+80};
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,candidates:Point[]=[];
  for(const fraction of [.5,.35,.65])for(const offset of [-65,65,-140,140,-240,240,-360,360])candidates.push({x:a.x+dx*fraction-dy/len*offset-38,y:a.y+dy*fraction+dx/len*offset-38});
  for(const fraction of [.35,.5,.65])for(const y of [Math.min(a.y,b.y)-110,Math.max(a.y,b.y)+170])candidates.push({x:a.x+dx*fraction-38,y:y-38});
  const cost=(p:Point)=>{const center={x:p.x+38,y:p.y+38},label=mirrorLabel(p),body={x:p.x-12,y:p.y-12,width:100,height:90};let score=0;
   for(const obstacle of [...labels,...bodies,...occupied]){if(overlaps(label,obstacle)||overlaps(body,obstacle))score+=1e7;}
   for(const obstacle of [...labels,...occupied,label])if(crosses(obstacle,{a,b:center})||crosses(obstacle,{a:center,b}))score+=1e6;
   for(const ray of rays){if(crosses(label,ray)||crosses(body,ray))score+=1e6;if(intersection(a,center,ray.a,ray.b)||intersection(center,b,ray.a,ray.b))score+=1e5;}
   return score;};
  const chosen=candidates.map((p,i)=>({p,score:cost(p)+i})).sort((a,b)=>a.score-b.score)[0].p;
  result[edge.id]=chosen;occupied.push(mirrorLabel(chosen),{x:chosen.x-12,y:chosen.y-12,width:100,height:90});const center={x:chosen.x+38,y:chosen.y+38};rays.push({a,b:center},{a:center,b});
 }
 return result;
}
/** Tidy bilateral tree: each branch owns a contiguous vertical band. */
export function balancedLayout(nodes:KnowledgeNode[],edges:Relation[],root:string){
 const tree=primaryTree(nodes,edges,root),positions:Record<string,Point>={},weight=new Map<string,number>();
 const measure=(id:string):number=>{const value=Math.max(1,tree.children.get(id)!.reduce((sum,child)=>sum+measure(child),0));weight.set(id,value);return value;};
 if(tree.depth.has(root)){measure(root);positions[root]={x:0,y:0};
  const groups:[string[],string[]]=[[],[]],loads=[0,0];
  for(const child of [...tree.children.get(root)!].sort((a,b)=>weight.get(b)!-weight.get(a)!||a.localeCompare(b))){const side=loads[0]<=loads[1]?0:1;groups[side].push(child);loads[side]+=weight.get(child)!;}
  const place=(id:string,sign:number,start:number)=>{const height=weight.get(id)!*520;positions[id]={x:sign*tree.depth.get(id)!*1100,y:start+height/2};let cursor=start;for(const child of tree.children.get(id)!){place(child,sign,cursor);cursor+=weight.get(child)!*520;}};
  groups.forEach((items,side)=>{let cursor=-loads[side]*520/2;for(const id of items){place(id,side===0?-1:1,cursor);cursor+=weight.get(id)!*520;}});
 }
 const bottom=Math.max(0,...Object.values(positions).map(p=>p.y))+850;
 nodes.filter(n=>!positions[n.id]).sort((a,b)=>a.id.localeCompare(b.id)).forEach((n,i)=>{positions[n.id]={x:(i%3-1)*1100,y:bottom+Math.floor(i/3)*520};});
 return {prisms:positions,mirrors:routeMirrors(positions,edges),treeEdges:tree.treeEdges};
}
/** Collapsed mirrors use outer shelves, never a tiny fan around their parent. */
export function routeFrontiers(positions:Record<string,Point>,frontier:{edge:Relation;source:string;target:string}[],root:string,mirrors:Record<string,Point>={}){
 const result:Record<string,Point>={},occupied:Box[]=[...Object.values(positions).map(p=>({x:p.x-170,y:p.y-30,width:540,height:340})),...Object.values(mirrors).map(p=>({x:p.x-190,y:p.y-20,width:460,height:250}))];
 const origin=positions[root]||{x:0,y:0};
 for(const f of [...frontier].sort((a,b)=>a.source.localeCompare(b.source)||a.edge.id.localeCompare(b.edge.id))){const p=positions[f.source];if(!p)continue;const siblings=frontier.filter(e=>e.source===f.source).sort((a,b)=>a.edge.id.localeCompare(b.edge.id)),index=siblings.findIndex(e=>e.edge.id===f.edge.id),sign=p.x<origin.x?-1:1;
  const candidates:Point[]=[];for(let lane=0;lane<5;lane++)for(let shift=0;shift<12;shift++){const delta=shift===0?0:Math.ceil(shift/2)*340*(shift%2?1:-1);candidates.push({x:p.x+sign*(650+lane*560),y:p.y+(index-(siblings.length-1)/2)*340+delta});}
  const score=(m:Point)=>{const box={x:m.x-190,y:m.y-20,width:460,height:250};let value=0;for(const o of occupied)if(overlaps(box,o))value+=1e7;for(const n of Object.values(positions))if(crosses(labelBox(n),{a:{x:p.x+100,y:p.y+80},b:{x:m.x+38,y:m.y+38}}))value+=1e6;return value;};
  const chosen=candidates.map((p,i)=>({p,score:score(p)+i})).sort((a,b)=>a.score-b.score)[0].p;result[f.edge.id]=chosen;occupied.push({x:chosen.x-190,y:chosen.y-20,width:460,height:250});
 }
 return result;
}
