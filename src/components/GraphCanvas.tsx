'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Minus} from 'lucide-react';
import {placeLabelWithin,type Box,type Segment} from '@/lib/label-placement';
import {ReactFlow,Controls,ControlButton,useNodesState,type ReactFlowProps,type ReactFlowInstance,type NodeChange} from '@xyflow/react';

type Props=ReactFlowProps&{reveal?:{id:string;epoch:number}|null;onRevealHandled?:(epoch:number)=>void};
/** React Flow owns geometry. Labels/leaders are disposable screen-space presentation. */
export default function GraphCanvas({nodes:incoming=[],reveal,onRevealHandled,...props}:Props){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null),leaders=useRef<SVGSVGElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 const [hiddenLabels,setHiddenLabels]=useState(0);
 const dragging=useRef<string|null>(null),hovered=useRef<string|null>(null);
 const labelFrame=useRef(0),fitted=useRef(false),autoFit=useRef(true);
 const lastReveal=useRef<number|null>(null);
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function arrangeLabels(){
  cancelAnimationFrame(labelFrame.current);
  labelFrame.current=requestAnimationFrame(()=>{
   const host=container.current;if(!host||!instance)return;
   const zoom=instance.getViewport().zoom;
   host.style.setProperty('--label-scale',String(1/zoom));
   host.dataset.overview=String(zoom<.4);
   const labels=Array.from(host.querySelectorAll<HTMLElement>('.graph-label'));
   // One reset pass, one measurement pass, then one write pass.
   labels.forEach(el=>{el.style.translate='0px 0px';el.style.visibility='visible';});
   const outer=host.getBoundingClientRect();
   const rect=(el:Element):Box=>{const r=el.getBoundingClientRect();return {x:r.x-outer.x,y:r.y-outer.y,width:r.width,height:r.height};};
   const bounds={x:12,y:12,width:Math.max(0,outer.width-24),height:Math.max(0,outer.height-84)};
   const obstacles=Array.from(host.querySelectorAll('.prism-shape,.mirror-shape,.react-flow__controls')).map(rect);
   const lines:Segment[]=[];
   host.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach(path=>{
    const matrix=path.getScreenCTM();if(!matrix)return;
    const a=path.getPointAtLength(0).matrixTransform(matrix),b=path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
    lines.push({a:{x:a.x-outer.x,y:a.y-outer.y},b:{x:b.x-outer.x,y:b.y-outer.y}});
   });
   const measured=labels.map(el=>{
    const owner=el.closest<HTMLElement>('.react-flow__node')!;
    const shape=owner.querySelector('.prism-shape,.mirror-shape')!;
    const priority=owner.classList.contains('selected')||owner.dataset.id===hovered.current;
    return {el,box:rect(el),shape:rect(shape),priority,mirror:owner.classList.contains('react-flow__node-mirror')};
   }).sort((a,b)=>Number(b.priority)-Number(a.priority)||Number(a.mirror)-Number(b.mirror));
   let hidden=0;const leaderLines:Segment[]=[];
   const placed=measured.map(item=>{
    const {box,shape,priority}=item;
    const onScreen=shape.x+shape.width>=0&&shape.y+shape.height>=0&&shape.x<=outer.width&&shape.y<=outer.height;
    const result=onScreen?placeLabelWithin(box,obstacles,lines,bounds,priority?320:item.mirror?144:224):null;
    if(!result){if(onScreen)hidden++;return {...item,result:null};}
    obstacles.push(result);
    if(Math.hypot(result.x-box.x,result.y-box.y)>12||priority){
     const a={x:shape.x+shape.width/2,y:shape.y+shape.height/2};
     const b={x:Math.max(result.x,Math.min(a.x,result.x+result.width)),y:Math.max(result.y,Math.min(a.y,result.y+result.height))};
     leaderLines.push({a,b});
    }
    return {...item,result};
   });
   placed.forEach(({el,box,result})=>{el.style.visibility=result?'visible':'hidden';if(result)el.style.translate=`${(result.x-box.x)/zoom}px ${(result.y-box.y)/zoom}px`;});
   if(leaders.current){
    leaders.current.replaceChildren(...leaderLines.map(({a,b})=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,String(value));return line;}));
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
  fitted.current=true;fitAll();
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
    if(autoFit.current)fitAll();
    else{const v=instance.getViewport();void instance.setViewport({...v,x:v.x+(width-previous.width)/2,y:v.y+(height-previous.height)/2},{duration:0}).then(arrangeLabels);}
    previous={width,height};
   });
  });
  observer.observe(container.current);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[instance]);
 useEffect(()=>{
  setNodes(previous=>incoming.map(node=>{
   const existing=previous.find(item=>item.id===node.id);
   return existing?{...existing,...node,measured:existing.measured}:node;
  }));
 },[incoming,setNodes]);
 // Search changes which objects are present; do not refit after a drag or selection.
 const membership=incoming.map(n=>n.id).sort().join('|');
 useEffect(()=>{if(instance&&fitted.current)fitAll();},[membership,instance]);
 useEffect(()=>{
  if(!instance||!reveal||lastReveal.current===reveal.epoch||!nodes.some(n=>n.id===reveal.id&&n.measured?.width))return;
  autoFit.current=false;
  let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   const node=instance.getInternalNode(reveal.id);if(!node)return;
   lastReveal.current=reveal.epoch;
   void instance.setCenter(node.internals.positionAbsolute.x+(node.measured.width||200)/2,node.internals.positionAbsolute.y+(node.measured.height||211)/2,{zoom:.8,duration:reduced()?0:180}).then(()=>{arrangeLabels();onRevealHandled?.(reveal.epoch);});
  });});
  return()=>cancelAnimationFrame(frame);
 },[instance,reveal,nodes]);
 return <div className="graph-host" ref={container} onMouseOver={event=>{const id=(event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null;if(id!==hovered.current){hovered.current=id;arrangeLabels();}}} onMouseLeave={()=>{hovered.current=null;arrangeLabels();}} onFocus={event=>{hovered.current=(event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null;arrangeLabels();}}>
  <ReactFlow {...props} fitView={false} onMoveStart={(event,viewport)=>{if(event)autoFit.current=false;props.onMoveStart?.(event,viewport);}} onMove={(event,viewport)=>{arrangeLabels();props.onMove?.(event,viewport);}} multiSelectionKeyCode={null} selectionKeyCode={null} selectionOnDrag={false} onNodeDragStart={(event,node,items)=>{dragging.current=node.id;autoFit.current=false;setNodes(ns=>ns.map(n=>({...n,selected:n.id===node.id})));props.onNodeDragStart?.(event,node,items);}} onNodeDragStop={(event,node,items)=>{props.onNodeDragStop?.(event,node,items);dragging.current=null;}} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={nodes} onNodesChange={changeNodes}>
   {props.children}<Controls showZoom={false} showInteractive={false} onFitView={fitAll}><ControlButton aria-label="Zoom In" onClick={()=>{autoFit.current=false;void instance?.zoomIn({duration:reduced()?0:180});}}><Plus/></ControlButton><ControlButton aria-label="Zoom Out" onClick={()=>{autoFit.current=false;void instance?.zoomOut({duration:reduced()?0:180});}}><Minus/></ControlButton></Controls>
  </ReactFlow>
  <svg ref={leaders} className="label-leaders" aria-hidden="true"/>
  {hiddenLabels>0&&<div className="overview-note">概览已收起 {hiddenLabels} 个拥挤标签；选中物体、放大或切换列表查看。</div>}
 </div>;
}
