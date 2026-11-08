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
