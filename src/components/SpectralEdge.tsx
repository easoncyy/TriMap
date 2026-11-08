'use client';
import {BaseEdge,getStraightPath,useInternalNode,type EdgeProps} from '@xyflow/react';
import {reflectedDirection,type Point} from '@/lib/optics';

// Intersect the center-to-center ray with the measured card boundary.
// Fixed left/right handles create backwards Bezier loops when cards move.
function boundary(node:NonNullable<ReturnType<typeof useInternalNode>>,other:NonNullable<ReturnType<typeof useInternalNode>>){
 const w=node.measured.width||202,h=node.measured.height||160;
 const cx=node.internals.positionAbsolute.x+w/2,cy=node.internals.positionAbsolute.y+h/2;
 const dx=other.internals.positionAbsolute.x+(other.measured.width||202)/2-cx;
 const dy=other.internals.positionAbsolute.y+(other.measured.height||160)/2-cy;
 if(dx===0&&dy===0)return {x:cx+w/2,y:cy};
 const scale=1/Math.max(Math.abs(dx)/(w/2+5),Math.abs(dy)/(h/2+5));
 return {x:cx+dx*scale,y:cy+dy*scale};
}
export default function SpectralEdge({id,source,target,label,style,markerEnd,labelStyle,labelBgStyle,selected,data}:EdgeProps){
 const from=useInternalNode(source),to=useInternalNode(target);
 if(!from||!to)return null;
 const a=boundary(from,to),b=boundary(to,from);
 const [path,x,y]=getStraightPath({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y});
 const reflection=data?.reflection as {from:Point;angle:number}|undefined;
 const origin={x:from.internals.positionAbsolute.x+(from.measured.width||76)/2,y:from.internals.positionAbsolute.y+38};
 const direction=reflection?reflectedDirection(reflection.from,origin,reflection.angle):null;
 return <><BaseEdge id={id} path={path} markerEnd={markerEnd} style={{...style,strokeWidth:selected?2.5:style?.strokeWidth}} label={label} labelX={x} labelY={y} labelStyle={labelStyle} labelBgStyle={labelBgStyle} labelBgPadding={[7,4]} labelBgBorderRadius={4} interactionWidth={18}/>{direction&&<path d={`M${origin.x},${origin.y}l${direction.x*260},${direction.y*260}`} stroke="#c7efff" strokeWidth="2" strokeDasharray="5 5" opacity=".8" pointerEvents="none"/>}</>;
}
