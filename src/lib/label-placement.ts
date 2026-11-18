export type Box={x:number;y:number;width:number;height:number};
export type Segment={a:{x:number;y:number};b:{x:number;y:number}};
export function overlaps(a:Box,b:Box){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
export function crosses(box:Box,{a,b}:Segment){
 let lo=0,hi=1;
 for(const [origin,delta,min,max] of [[a.x,b.x-a.x,box.x,box.x+box.width],[a.y,b.y-a.y,box.y,box.y+box.height]]){
  if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;}
  else{const t1=(min-origin)/delta,t2=(max-origin)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
 }
 return true;
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
export function placeLabelWithin(box:Box,obstacles:Box[],lines:Segment[],bounds:Box,maxDistance=144):Box|null{
 const clamp=(p:Box)=>({...p,x:Math.max(bounds.x,Math.min(p.x,bounds.x+bounds.width-p.width)),y:Math.max(bounds.y,Math.min(p.y,bounds.y+bounds.height-p.height))});
 if(box.width>bounds.width||box.height>bounds.height)return null;
 let best:Box|null=null,bestScore=Infinity;
 const candidates=[clamp(box)];
 for(let radius=16;radius<=maxDistance;radius+=16)for(let i=0;i<16;i++){
  const angle=Math.PI/2+i*Math.PI/8;
  candidates.push(clamp({...box,x:box.x+Math.cos(angle)*radius,y:box.y+Math.sin(angle)*radius}));
 }
 for(const p of candidates){
  const padded={x:p.x-4,y:p.y-4,width:p.width+8,height:p.height+8};
  if(obstacles.some(o=>overlaps(padded,o)))continue;
  const score=Math.hypot(p.x-box.x,p.y-box.y)+lines.filter(l=>crosses(padded,l)).length*24;
  if(score<bestScore){best=p;bestScore=score;if(score===0)break;}
 }
 return best;
}
