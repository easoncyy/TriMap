'use client';
import {BaseEdge,getStraightPath,useInternalNode,type EdgeProps} from '@xyflow/react';
import {reflectedDirection,type Point} from '@/lib/optics';


// Intersect the center-to-center ray with the measured card boundary.
// Fixed left/right handles create backwards Bezier loops when cards move.
function opticalCenter(node:NonNullable<ReturnType<typeof useInternalNode>>){const p=node.internals.positionAbsolute;return node.type==='mirror'?{x:p.x+38,y:p.y+38}:{x:p.x+100,y:p.y+(node.data.lightSource?72:80)};}
function boundary(node:NonNullable<ReturnType<typeof useInternalNode>>,other:NonNullable<ReturnType<typeof useInternalNode>>){
 if(node.type==='spectral'||node.type==='mirror'){
  const c=opticalCenter(node),o=opticalCenter(other),dx=o.x-c.x,dy=o.y-c.y,len=Math.hypot(dx,dy)||1;
  if(node.type==='mirror'||node.data.lightSource){const radius=node.type==='mirror'?30:25;return {x:c.x+dx/len*radius,y:c.y+dy/len*radius};}
  // The glass rotates with the light, so approximate it with a circle rather than fixed vertices.
  const p=node.internals.positionAbsolute,glass={x:p.x+100,y:p.y+72},tx=o.x-glass.x,ty=o.y-glass.y,tlen=Math.hypot(tx,ty)||1;
  return {x:glass.x+tx/tlen*48,y:glass.y+ty/tlen*48};
 }
 const w=node.measured.width||202,h=node.measured.height||160;
 const cx=node.internals.positionAbsolute.x+w/2,cy=node.internals.positionAbsolute.y+h/2;
 const dx=other.internals.positionAbsolute.x+(other.measured.width||202)/2-cx;
 const dy=other.internals.positionAbsolute.y+(other.measured.height||160)/2-cy;
 if(dx===0&&dy===0)return {x:cx+w/2,y:cy};
 const scale=1/Math.max(Math.abs(dx)/(w/2+5),Math.abs(dy)/(h/2+5));
 return {x:cx+dx*scale,y:cy+dy*scale};
}


function rayGradient(id:string,a:Point,b:Point,active:boolean,color:string){
 return <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
  <stop offset="0" stopColor={color} stopOpacity={active?.22:.14}/>
  <stop offset="1" stopColor={color} stopOpacity={active?.95:.62}/>
 </linearGradient>;
}

/** Light as a fading ray: brightness increases toward the target, no arrowheads. */
export default function SpectralEdge({id,source,target,data}:EdgeProps){
 const from=useInternalNode(source),to=useInternalNode(target);
 if(!from||!to)return null;
 // Each real relation owns its continuous ray, including the segment inside glass.
 const a=from.type==='spectral'&&!from.data.lightSource?{x:from.internals.positionAbsolute.x+100,y:from.internals.positionAbsolute.y+72}:boundary(from,to);
 const b=to.type==='spectral'&&!to.data.lightSource?{x:to.internals.positionAbsolute.x+100,y:to.internals.positionAbsolute.y+72}:boundary(to,from);
 const [path]=getStraightPath({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y});
 const active=!!data?.active,color=typeof data?.color==='string'?data.color:'#efeee4';
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 const gradient=`ray-${id.replace(/[^a-zA-Z0-9_-]/g,'')}`;
 const reflection=data?.reflection as {from:Point;angle:number}|undefined;
 const origin={x:from.internals.positionAbsolute.x+(from.measured.width||76)/2,y:from.internals.positionAbsolute.y+38};
 const direction=reflection?reflectedDirection(reflection.from,origin,reflection.angle):null;
 const tip=direction?{x:origin.x+direction.x*300,y:origin.y+direction.y*300}:null;
 return <>
  <defs>{rayGradient(gradient,a,b,active,color)}</defs>
  <BaseEdge id={id} path={path} interactionWidth={22} style={{stroke:`url(#${gradient})`,strokeWidth:active?1.5:1,strokeLinecap:'round'}}/>
  {direction&&tip&&<g pointerEvents="none"><path d={`M${origin.x},${origin.y}L${tip.x},${tip.y}`} stroke="#dfe8dc" strokeWidth="1" opacity=".55"/><circle cx={tip.x} cy={tip.y} r="2.4" fill="#f2f1e6" opacity=".7"/></g>}
 </>;
}
