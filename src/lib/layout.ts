import type {KnowledgeNode,Relation} from './model';
import type {Point} from './optics';
import {crosses,overlaps,type Box} from './label-placement.ts';
export const LAYOUT_VERSION=4;
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
/** Give each branch a sector of a tilted celestial disk. Angles depend only on the full tree,
 * so opening a fold or changing the camera cannot shuffle the constellation. */
export function layoutPrisms(nodes:KnowledgeNode[],tree:ReturnType<typeof primaryTree>,root:string){
 const positions:Record<string,Point>={};
 const weights=new Map<string,number>();
 const measure=(id:string):number=>{
  const count=Math.max(1,(tree.children.get(id)||[]).reduce((sum,child)=>sum+measure(child),0));
  weights.set(id,count);
  return count;
 };
 function variation(id:string){
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0)/4294967296-.5;
 }
 const occupied:Point[]=[];
 function place(id:string,angle:number,radius:number){
  let point:Point;
  do {
   const x=radius*1.42*Math.cos(angle),y=radius*.84*Math.sin(angle);
   point={x:Math.round(x*.983+y*.184),y:Math.round(y*.983-x*.184)};
   radius+=95;
  } while(occupied.some(other=>Math.abs(point.x-other.x)<435&&Math.abs(point.y-other.y)<265));
  positions[id]=point;
  occupied.push(point);
 }
 function branch(id:string,start:number,arc:number,level:number){
  const children=tree.children.get(id)||[];
  const sizes=children.map(child=>Math.sqrt(weights.get(child)!));
  const total=sizes.reduce((a,b)=>a+b,0);
  for(const [i,child] of children.entries()){
   const width=arc*sizes[i]/total;
   const angle=start+width*(.5+.15*variation(child));
   place(child,angle,(490+level*445)*(1+.19*variation(child)));
   branch(child,start+width*.035,width*.93,level+1);
   start+=width;
  }
 }
 if(tree.depth.has(root)){
  measure(root);
  place(root,0,0);
  branch(root,-2.8,Math.PI*2,0);
 }
 const rim=Math.max(0,...occupied.map(p=>Math.hypot(p.x/1.42,p.y/.84)))+500;
 nodes.filter(n=>!positions[n.id]).sort((a,b)=>a.id.localeCompare(b.id)).forEach((node,i)=>{
  place(node.id,i*2.39996+.7,rim+130*Math.sqrt(i));
 });
 return positions;
}
export function balancedLayout(nodes:KnowledgeNode[],edges:Relation[],root:string){
 const tree=primaryTree(nodes,edges,root);
 const positions=layoutPrisms(nodes,tree,root);
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

/** Extend a layout without moving any previously placed knowledge, including hidden nodes. */
export function extendPositions(desired:Record<string,Point>,saved:Record<string,Point>){
 if(!Object.keys(saved).length)return {...desired};
 const result={...saved};
 for(const [id,wanted] of Object.entries(desired)){
  if(result[id])continue;
  let point={...wanted},step=0;
  while(Object.values(result).some(p=>Math.abs(p.x-point.x)<620&&Math.abs(p.y-point.y)<360)){
   step++;const ring=Math.ceil(step/8),angle=(step%8)*Math.PI/4;
   point={x:wanted.x+Math.round(Math.cos(angle)*ring*700),y:wanted.y+Math.round(Math.sin(angle)*ring*520)};
  }
  result[id]=point;
 }
 return result;
}
