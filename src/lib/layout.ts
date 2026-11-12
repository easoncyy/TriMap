import {crosses,type Box} from './label-placement.ts';
import type {KnowledgeNode,Relation} from './model';
import type {Point} from './optics';
export function routeMirrors(positions:Record<string,Point>,edges:Relation[]){
 const result:Record<string,Point>={},occupied:Point[]=[],rays:{a:Point;b:Point}[]=[];
 const labels:Box[]=Object.values(positions).map(p=>({x:p.x-80,y:p.y+136,width:360,height:100}));
 for(const edge of [...edges].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!positions[edge.source]||!positions[edge.target])continue;
  const a={x:positions[edge.source].x+100,y:positions[edge.source].y+80},b={x:positions[edge.target].x+100,y:positions[edge.target].y+80};
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const candidates:Point[]=[];
  for(const fraction of [.5,.4,.6])for(const distance of [85,-85,140,-140,200,-200,270,-270])candidates.push({x:a.x+dx*fraction-dy/length*distance-38,y:a.y+dy*fraction+dx/length*distance-38});
  function cost(p:Point){let score=0;
 const center={x:p.x+38,y:p.y+38},label={x:p.x-112,y:p.y+82,width:300,height:110};
 for(const l of labels)if(crosses(l,{a,b:center})||crosses(l,{a:center,b}))score+=200000;
 if(crosses(label,{a,b:center})||crosses(label,{a:center,b}))score+=200000;
 for(const ray of rays)if(crosses(label,ray))score+=200000;
 for(const n of Object.values(positions))if(label.x<n.x+210&&label.x+label.width>n.x-10&&label.y<n.y+136&&label.y+label.height>n.y)score+=100000;
for(const n of Object.values(positions))if(p.x<n.x+230&&p.x+90>n.x-25&&p.y<n.y+205&&p.y+115>n.y-20)score+=100000;for(const o of occupied)if(Math.abs(p.x-o.x)<310&&Math.abs(p.y-o.y)<200)score+=30000;return score;}
  const chosen=candidates.map((p,i)=>({p,score:cost(p)+i})).sort((a,b)=>a.score-b.score)[0].p;
  result[edge.id]=chosen;occupied.push(chosen);labels.push({x:chosen.x-112,y:chosen.y+82,width:300,height:110});const c={x:chosen.x+38,y:chosen.y+38};rays.push({a,b:c},{a:c,b});
 }
 return result;
}
/** Stable layered layout: connectivity determines depth, not an arbitrary node position. */
export function balancedLayout(nodes:KnowledgeNode[],edges:Relation[],root:string){
 const ids=new Set(nodes.map(n=>n.id)),adj=new Map(nodes.map(n=>[n.id,[] as string[]]));
 for(const e of edges)if(ids.has(e.source)&&ids.has(e.target)){adj.get(e.source)!.push(e.target);adj.get(e.target)!.push(e.source);}
 const depth=new Map<string,number>(),queue:string[]=[];
 function visit(start:string,base:number){depth.set(start,base);queue.push(start);for(let i=0;i<queue.length;i++){const at=queue[i];for(const next of [...adj.get(at)!].sort())if(!depth.has(next)){depth.set(next,depth.get(at)!+1);queue.push(next);}}}
 if(ids.has(root))visit(root,0);
 const connected=new Set(depth.keys());
 for(const n of [...nodes].sort((a,b)=>a.id.localeCompare(b.id)))if(!depth.has(n.id))visit(n.id,0);
 const levels=new Map<number,string[]>();for(const n of nodes.filter(n=>connected.has(n.id))){const d=depth.get(n.id)!;levels.set(d,[...(levels.get(d)||[]),n.id]);}
 const positions:Record<string,Point>={},height=Math.max(1,...[...levels.values()].map(x=>x.length))*260;
 // Full rings distribute branches around the light instead of a single right-hand column.
 for(const [d,items] of [...levels.entries()].sort((a,b)=>a[0]-b[0])){
  items.sort();
  const radius=d===0?0:Math.max(d*620,items.length*440/(2*Math.PI));
  items.forEach((id,i)=>{const angle=-Math.PI/2+i*2*Math.PI/items.length;
   positions[id]={x:80+Math.cos(angle)*radius,y:80+Math.sin(angle)*radius};});
 }
 const detached=nodes.filter(n=>!connected.has(n.id)).sort((a,b)=>a.id.localeCompare(b.id));
 detached.forEach((n,i)=>{positions[n.id]={x:80+(i%3)*620,y:height+900+Math.floor(i/3)*300};});
 return {prisms:positions,mirrors:routeMirrors(positions,edges)};
}
