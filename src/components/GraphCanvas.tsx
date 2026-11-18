'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Minus} from 'lucide-react';
import {locateCamera,restoreCamera,type CameraSnapshot,type RevealRequest} from '@/lib/exploration-navigation';
import {placeLabelWithin,type Box,type Segment} from '@/lib/label-placement';
import {ReactFlow,Controls,ControlButton,useNodesState,type ReactFlowProps,type ReactFlowInstance,type NodeChange} from '@xyflow/react';

type Props=ReactFlowProps&{fitScope:string;reveal?:RevealRequest|null;onRevealHandled?:(epoch:number)=>void;onViewChange?:(snapshot:CameraSnapshot)=>void};
/** React Flow owns geometry. Labels/leaders are disposable screen-space presentation. */
export default function GraphCanvas({nodes:incoming=[],fitScope,reveal,onRevealHandled,onViewChange,...props}:Props){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null),leaders=useRef<SVGSVGElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 const [hiddenLabels,setHiddenLabels]=useState(0);
 const dragging=useRef<string|null>(null),hovered=useRef<string|null>(null);
 const labelFrame=useRef(0),fitted=useRef(false),autoFit=useRef(true);
 const lastReveal=useRef<number|null>(null);
 const rayEndpoints=useRef(new WeakMap<SVGPathElement,{d:string;a:DOMPoint;b:DOMPoint}>());
 const pendingReveal=useRef(reveal);pendingReveal.current=reveal;
 const viewCallback=useRef(onViewChange);viewCallback.current=onViewChange;
 function publishView(){const host=container.current;if(host&&instance)viewCallback.current?.({viewport:instance.getViewport(),width:host.clientWidth,height:host.clientHeight});}
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function arrangeLabels(){
  cancelAnimationFrame(labelFrame.current);
  labelFrame.current=requestAnimationFrame(()=>{
   const host=container.current;if(!host||!instance)return;
   const zoom=instance.getViewport().zoom;
   host.style.setProperty('--label-scale',String(1/zoom));
   host.dataset.overview=String(zoom<.4);host.dataset.detail=String(zoom>=.65);
   host.querySelectorAll<HTMLElement>('.react-flow__node').forEach(owner=>{owner.dataset.labelPriority=String(owner.classList.contains('selected')||owner.dataset.id===hovered.current);});
   const labels=Array.from(host.querySelectorAll<HTMLElement>('.graph-label'));
   // One reset pass, one measurement pass, then one write pass.
   labels.forEach(el=>{el.style.translate='0px 0px';el.style.visibility='visible';});
   const outer=host.getBoundingClientRect();
   const rect=(el:Element):Box=>{const r=el.getBoundingClientRect();return {x:r.x-outer.x,y:r.y-outer.y,width:r.width,height:r.height};};
   const bounds={x:12,y:12,width:Math.max(0,outer.width-24),height:Math.max(0,outer.height-84)};
   const controlBoxes=Array.from(host.querySelectorAll('.react-flow__controls')).map(rect);
   const lines:Segment[]=[];
   host.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach(path=>{
    const matrix=path.getScreenCTM();if(!matrix)return;
    const d=path.getAttribute('d')||'';
    let endpoints=rayEndpoints.current.get(path);
    if(!endpoints||endpoints.d!==d){
     endpoints={d,a:path.getPointAtLength(0),b:path.getPointAtLength(path.getTotalLength())};
     rayEndpoints.current.set(path,endpoints);
    }
    const a=endpoints.a.matrixTransform(matrix),b=endpoints.b.matrixTransform(matrix);
    lines.push({a:{x:a.x-outer.x,y:a.y-outer.y},b:{x:b.x-outer.x,y:b.y-outer.y}});
   });
   const measured=labels.map(el=>{
    const owner=el.closest<HTMLElement>('.react-flow__node')!;
    const shape=owner.querySelector('.prism-shape,.mirror-shape')!;
    const priority=owner.dataset.labelPriority==='true';
    return {el,rank:owner.classList.contains('selected')?2:priority?1:0,owner:owner.dataset.id!,path:owner.classList.contains('navigation-mirror'),box:rect(el),shape:rect(shape),priority,mirror:owner.classList.contains('react-flow__node-mirror')};
   }).sort((a,b)=>b.rank-a.rank||Number(a.mirror)-Number(b.mirror));
   const obstacles=measured.map(item=>item.shape).concat(controlBoxes);
   const peerShapes=[measured.filter(item=>!item.mirror),measured.filter(item=>item.mirror)];
   const labelObstacles:Box[]=[];
   let hidden=0;const leaderLines:Array<Segment&{owner:string;priority:boolean}>=[];
   const placed=measured.map(item=>{
    const {box,shape,priority}=item;
    const onScreen=shape.x+shape.width>=0&&shape.y+shape.height>=0&&shape.x<=outer.width&&shape.y<=outer.height;
    const eligible=onScreen&&(!item.mirror||zoom>=.4||priority||item.path);
    let result=eligible?placeLabelWithin(box,obstacles,lines,bounds,priority?112:zoom<.4?64:96,{owner:shape,peers:peerShapes[Number(item.mirror)].map(other=>other.shape)}):null;
    // Selected/focused text wins over the optional labels, never over the zoom controls.
    if(eligible&&priority&&!result)result=placeLabelWithin(box,[shape,...labelObstacles,...controlBoxes],lines,bounds,112);
    if(!result){if(onScreen)hidden++;return {...item,result:null};}
    obstacles.push(result);labelObstacles.push(result);
    if(Math.hypot(result.x-box.x,result.y-box.y)>12||priority){
     const a={x:shape.x+shape.width/2,y:shape.y+shape.height/2};
     const b={x:Math.max(result.x,Math.min(a.x,result.x+result.width)),y:Math.max(result.y,Math.min(a.y,result.y+result.height))};
     const dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.min(1,1/Math.max(Math.abs(dx)/(shape.width/2||1),Math.abs(dy)/(shape.height/2||1)));
     leaderLines.push({a:{x:a.x+dx*t,y:a.y+dy*t},b,owner:item.owner,priority});
    }
    return {...item,result};
   });
   placed.forEach(({el,box,result})=>{el.style.visibility=result?'visible':'hidden';if(result)el.style.translate=`${(result.x-box.x)/zoom}px ${(result.y-box.y)/zoom}px`;});
   if(leaders.current){
    leaders.current.replaceChildren(...leaderLines.map(({a,b,owner,priority})=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,String(value));line.dataset.owner=owner;line.classList.toggle('priority-leader',priority);return line;}));
   }
   setHiddenLabels(previous=>previous===hidden?previous:hidden);
  });
 }
 function fitAll(){
  if(!instance)return;
  autoFit.current=true;
  // The former .25 minimum cropped the graph before fitView could fit it.
  void instance.fitView({padding:.2,minZoom:.02,maxZoom:1,duration:0}).then(arrangeLabels);
 }
 useEffect(()=>{arrangeLabels();return()=>cancelAnimationFrame(labelFrame.current);},[nodes,props.edges,instance]);
 useEffect(()=>{
  let alive=true;document.fonts.ready.then(()=>{if(alive)arrangeLabels();});
  return()=>{alive=false;};
 },[instance]);
 useEffect(()=>{
  if(!instance||fitted.current||!nodes.length||nodes.some(n=>!n.measured?.width))return;
  fitted.current=true;if(!pendingReveal.current)fitAll();
 },[nodes,instance]);

 function changeNodes(changes:NodeChange[]){
  const selection=changes.find(c=>c.type==='select'&&c.selected);
  if(selection?.type==='select')setNodes(ns=>ns.map(n=>({...n,selected:n.id===selection.id})));
  onNodesChange(changes.filter(c=>c.type!=='position'||!dragging.current||c.id===dragging.current));
 }
 useEffect(()=>{
  if(!instance||!container.current)return;
  let frame=0,previous={width:container.current.clientWidth,height:container.current.clientHeight};
  const observer=new ResizeObserver(()=>{
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    const host=container.current;if(!host)return;
    const width=host.clientWidth,height=host.clientHeight;
    if(pendingReveal.current){arrangeLabels();}
    else if(autoFit.current)fitAll();
    else{const v=instance.getViewport();void instance.setViewport({...v,x:v.x+(width-previous.width)/2,y:v.y+(height-previous.height)/2},{duration:0}).then(arrangeLabels);}
    previous={width,height};
   });
  });
  observer.observe(container.current);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[instance]);
 useEffect(()=>{
  setNodes(previous=>{
   const previousById=new Map(previous.map(node=>[node.id,node]));
   return incoming.map(node=>{
    const existing=previousById.get(node.id);
    return existing?{...existing,...node,measured:existing.measured}:node;
   });
  });
 },[incoming,setNodes]);
 // Search and view changes refit. Expanding a relation keeps the same camera.
 useEffect(()=>{if(instance&&fitted.current&&!pendingReveal.current)fitAll();},[fitScope,instance]);
 useEffect(()=>{
  if(!instance||!reveal||lastReveal.current===reveal.epoch||!nodes.some(n=>n.id===reveal.id&&n.measured?.width))return;
  autoFit.current=false;
  let frame=0;
  // Let the reading/explorer layout and ResizeObserver settle before locating the target.
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   const host=container.current,node=instance.getInternalNode(reveal.id);if(!host||!node)return;
   lastReveal.current=reveal.epoch;
   const current=instance.getViewport();
   const shape=host.querySelector(`[data-id="${CSS.escape(reveal.id)}"] .prism-shape, [data-id="${CSS.escape(reveal.id)}"] .mirror-shape`);if(!shape)return;
   const r=shape.getBoundingClientRect(),h=host.getBoundingClientRect();
   const object={x:(r.x-h.x-current.x)/current.zoom,y:(r.y-h.y-current.y)/current.zoom,width:r.width/current.zoom,height:r.height/current.zoom};
   const safe={x:64,y:16,width:Math.max(1,host.clientWidth-80),height:Math.max(1,host.clientHeight-84)};
   const origin=reveal.restore?restoreCamera(reveal.restore,host.clientWidth,host.clientHeight):current;
   const next=locateCamera(origin,object,safe,!!reveal.restore);
   const changed=Math.abs(current.x-next.x)>.5||Math.abs(current.y-next.y)>.5||Math.abs(current.zoom-next.zoom)>.001;
   void (changed?instance.setViewport(next,{duration:reduced()?0:180}):Promise.resolve(true)).then(()=>{
    if(!container.current||lastReveal.current!==reveal.epoch)return;arrangeLabels();publishView();onRevealHandled?.(reveal.epoch);
   });
  });});
  return()=>cancelAnimationFrame(frame);
 },[instance,reveal,nodes]);
 return <div className="graph-host" ref={container} onMouseOver={event=>{const id=(event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null;if(id!==hovered.current){hovered.current=id;arrangeLabels();}}} onMouseLeave={()=>{hovered.current=null;arrangeLabels();}} onBlur={()=>{hovered.current=null;arrangeLabels();}} onFocus={event=>{hovered.current=(event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null;arrangeLabels();}}>
  <ReactFlow {...props} fitView={false} onMoveEnd={(event,viewport)=>{publishView();props.onMoveEnd?.(event,viewport);}} onMoveStart={(event,viewport)=>{if(event)autoFit.current=false;props.onMoveStart?.(event,viewport);}} onMove={(event,viewport)=>{arrangeLabels();props.onMove?.(event,viewport);}} multiSelectionKeyCode={null} selectionKeyCode={null} selectionOnDrag={false} onNodeDragStart={(event,node,items)=>{dragging.current=node.id;autoFit.current=false;setNodes(ns=>ns.map(n=>({...n,selected:n.id===node.id})));props.onNodeDragStart?.(event,node,items);}} onNodeDragStop={(event,node,items)=>{props.onNodeDragStop?.(event,node,items);dragging.current=null;}} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={nodes} onNodesChange={changeNodes}>
   {props.children}<Controls showZoom={false} showInteractive={false} onFitView={fitAll}><ControlButton aria-label="Zoom In" onClick={()=>{autoFit.current=false;void instance?.zoomIn({duration:reduced()?0:180});}}><Plus/></ControlButton><ControlButton aria-label="Zoom Out" onClick={()=>{autoFit.current=false;void instance?.zoomOut({duration:reduced()?0:180});}}><Minus/></ControlButton></Controls>
  </ReactFlow>
  <svg ref={leaders} className="label-leaders" aria-hidden="true"/>
  {hiddenLabels>0&&<div className="overview-note">概览已收起 {hiddenLabels} 个拥挤标签；选中物体、放大或切换列表查看。</div>}
 </div>;
}
