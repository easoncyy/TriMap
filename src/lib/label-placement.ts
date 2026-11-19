export type Box={x:number;y:number;width:number;height:number};
export type Segment={a:{x:number;y:number};b:{x:number;y:number}};
export function overlaps(a:Box,b:Box){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
export function crosses(box:Box,{a,b}:Segment){
 let lo=0,hi=1;
 const dx=b.x-a.x,dy=b.y-a.y;
 if(Math.abs(dx)<1e-9){
  if(a.x<box.x||a.x>box.x+box.width)return false;
 }else{
  const entry=(box.x-a.x)/dx,exit=(box.x+box.width-a.x)/dx;
  lo=Math.max(lo,Math.min(entry,exit));
  hi=Math.min(hi,Math.max(entry,exit));
  if(lo>hi)return false;
 }
 if(Math.abs(dy)<1e-9)return a.y>=box.y&&a.y<=box.y+box.height;
 const entry=(box.y-a.y)/dy,exit=(box.y+box.height-a.y)/dy;
 return Math.max(lo,Math.min(entry,exit))<=Math.min(hi,Math.max(entry,exit));
}
export function placeLabel(box:Box,obstacles:Box[],lines:Segment[]):Box{
 const clear=(p:Box)=>{const padded={x:p.x-7,y:p.y-7,width:p.width+14,height:p.height+14};return !obstacles.some(o=>overlaps(padded,o))&&!lines.some(l=>crosses(padded,l));};
 if(clear(box))return box;
 for(let radius=16;radius<=2048;radius+=16){const count=Math.max(16,Math.ceil(2*Math.PI*radius/20));for(let i=0;i<count;i++){const angle=Math.PI/2+i*2*Math.PI/count;const p={...box,x:box.x+Math.cos(angle)*radius,y:box.y+Math.sin(angle)*radius};if(clear(p))return p;}}
 // Guaranteed clear fallback outside all finite geometry, rather than accepting overlap.
 const bottom=Math.max(box.y,...obstacles.map(o=>o.y+o.height),...lines.flatMap(l=>[l.a.y,l.b.y]));
 return {...box,y:bottom+20};
}

/** Bounded screen-space placement. Hide an optional overview label rather than
 * sending it thousands of pixels away from its owner. Rays are a soft cost;
 * opaque label grounds keep text readable where crossing cannot be avoided. */
export function placeLabelWithin(box:Box,obstacles:Box[],lines:Segment[],bounds:Box,maxDistance=144,ownership?:{owner:Box;peers:Box[]}):Box|null{
 const clamp=(p:Box)=>({...p,x:Math.max(bounds.x,Math.min(p.x,bounds.x+bounds.width-p.width)),y:Math.max(bounds.y,Math.min(p.y,bounds.y+bounds.height-p.height))});
 if(box.width>bounds.width||box.height>bounds.height)return null;
 let best:Box|null=null,bestScore=Infinity;
 // Everything a candidate or its padding can touch lies inside this area.
 const reach={x:box.x-maxDistance-4,y:box.y-maxDistance-4,width:box.width+(maxDistance+4)*2,height:box.height+(maxDistance+4)*2};
 const nearbyObstacles=obstacles.filter(o=>overlaps(reach,o));
 let nearbyLines:Segment[]|undefined;
 function consider(x:number,y:number){
  const p=clamp({...box,x,y});
  const displacement=Math.hypot(p.x-box.x,p.y-box.y);
  if(displacement>maxDistance||displacement>=bestScore)return;
  if(ownership){
   const cx=p.x+p.width/2,cy=p.y+p.height/2;
   const squaredDistance=(o:Box)=>{
    const dx=Math.max(o.x-cx,0,cx-o.x-o.width),dy=Math.max(o.y-cy,0,cy-o.y-o.height);
    return dx*dx+dy*dy;
   };
   const own=squaredDistance(ownership.owner);
   if(own>144){
    const threshold=(Math.sqrt(own)-12)**2;
    if(ownership.peers.some(peer=>squaredDistance(peer)<threshold))return;
   }
  }
  const padded={x:p.x-4,y:p.y-4,width:p.width+8,height:p.height+8};
  if(nearbyObstacles.some(o=>overlaps(padded,o)))return;
  if(!nearbyLines){
   nearbyLines=lines.filter(({a,b})=>
    Math.max(a.x,b.x)>=reach.x&&Math.min(a.x,b.x)<=reach.x+reach.width&&
    Math.max(a.y,b.y)>=reach.y&&Math.min(a.y,b.y)<=reach.y+reach.height
   );
  }
  let score=displacement;
  for(const line of nearbyLines){
   if(crosses(padded,line))score+=24;
   if(score>=bestScore)return;
  }
  best=p;bestScore=score;
 }
 consider(box.x,box.y);
 for(let radius=16;radius<=maxDistance&&bestScore!==0;radius+=16){
  for(let i=0;i<16;i++){
   const angle=Math.PI/2+i*Math.PI/8;
   consider(box.x+Math.cos(angle)*radius,box.y+Math.sin(angle)*radius);
  }
 }
 return best;
}
