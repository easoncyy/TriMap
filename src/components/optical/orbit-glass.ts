import type {Node,Viewport} from '@xyflow/react';
import type {Point} from '@/lib/optics';
import type {Stone} from './prism-surface';

export type GlassAnchor = {offset:Point; span:number; mirrorId?:string; material?:Pick<Stone,'focused'|'energy'|'lens'>};

// Node positions already include orbital projection. Only the offset between
// the SVG's visual center and its React Flow origin requires a DOM measurement.
export function orbitStones(nodes:Node[], anchors:Map<string,GlassAnchor>, view:Viewport):Stone[]|null {
 const centers=new Map<string,Point>();
 for(const node of nodes){
  const anchor=anchors.get(node.id);
  if(!anchor)return null;
  centers.set(node.id,{
   x:(node.position.x+anchor.offset.x)*view.zoom+view.x,
   y:(node.position.y+anchor.offset.y)*view.zoom+view.y,
  });
 }
 const stones:Stone[]=[];
 for(const node of nodes){
  const anchor=anchors.get(node.id)!;
  if(!anchor.material)continue;
  const center=centers.get(node.id)!;
  const mirror=anchor.mirrorId?centers.get(anchor.mirrorId):undefined;
  const span=anchor.span*view.zoom*Number(node.data.orbitScale??1);
  stones.push({...anchor.material,id:node.id,x:center.x-span/2,y:center.y-span/2,span,
   light:mirror?{x:mirror.x-center.x,y:center.y-mirror.y}:{x:-.85,y:.45}});
 }
 return stones;
}
