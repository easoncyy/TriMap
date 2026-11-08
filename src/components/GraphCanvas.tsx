'use client';
import {useEffect,useRef,useState} from 'react';
import {placeLabel,type Box,type Segment} from '@/lib/label-placement';
import {ReactFlow,useNodesState,type ReactFlowProps,type ReactFlowInstance,type NodeChange} from '@xyflow/react';

/** Keep React Flow's measured dimensions and drag state inside the canvas.
 * The application only persists completed drags, not every pointer movement.
 */
export default function GraphCanvas({nodes:incoming=[],...props}:ReactFlowProps){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 const dragging=useRef<string|null>(null);
 const labelFrame=useRef(0);
 function arrangeLabels(){
  cancelAnimationFrame(labelFrame.current);
  labelFrame.current=requestAnimationFrame(()=>{
   const host=container.current;if(!host)return;
   const zoom=instance?.getViewport().zoom||1;
   const labels=Array.from(host.querySelectorAll<HTMLElement>('.node-kind,.optical-node strong,.mirror-relation-name,.routing-mirror small'));
   labels.forEach(el=>{el.style.translate='0px 0px';});
   const rect=(el:Element):Box=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   const obstacles=Array.from(host.querySelectorAll('.prism-shape,.mirror-shape,.react-flow__handle')).filter(el=>el.getBoundingClientRect().width>0).map(rect);
   const lines:Segment[]=[];
   host.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach(path=>{
    const matrix=path.getScreenCTM();if(!matrix)return;
    const length=path.getTotalLength();const a=path.getPointAtLength(0).matrixTransform(matrix),b=path.getPointAtLength(length).matrixTransform(matrix);lines.push({a,b});
   });
   labels.forEach(el=>{const box=rect(el);if(!box.width||!box.height)return;const placed=placeLabel(box,obstacles,lines);el.style.translate=`${(placed.x-box.x)/zoom}px ${(placed.y-box.y)/zoom}px`;obstacles.push(placed);});
  });
 }
 useEffect(()=>{arrangeLabels();return()=>cancelAnimationFrame(labelFrame.current);},[nodes,props.edges,instance]);
 useEffect(()=>{document.fonts.ready.then(arrangeLabels);},[instance]);

 function changeNodes(changes:NodeChange[]){
  const selection=changes.find(c=>c.type==='select'&&c.selected);
  if(selection?.type==='select')setNodes(ns=>ns.map(n=>({...n,selected:n.id===selection.id})));
  onNodesChange(changes.filter(c=>c.type!=='position'||!dragging.current||c.id===dragging.current));
 }
 useEffect(()=>{
  if(!instance||!container.current)return;
  let frame=0;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>instance.fitView({padding:0.2,maxZoom:1,duration:180}));});
  observer.observe(container.current);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[instance]);
 useEffect(()=>{
  setNodes(previous=>incoming.map(node=>{
   const existing=previous.find(item=>item.id===node.id);
   return existing?{...existing,...node,measured:existing.measured}:node;
  }));
 },[incoming,setNodes]);
 return <div ref={container} style={{width:'100%',height:'100%',minHeight:0}}><ReactFlow {...props} onMove={(event,viewport)=>{container.current?.style.setProperty('--label-scale',String(Math.min(3,1/Math.max(.2,viewport.zoom))));arrangeLabels();props.onMove?.(event,viewport);}} multiSelectionKeyCode={null} selectionKeyCode={null} selectionOnDrag={false} onNodeDragStart={(event,node,items)=>{dragging.current=node.id;setNodes(ns=>ns.map(n=>({...n,selected:n.id===node.id})));props.onNodeDragStart?.(event,node,items);}} onNodeDragStop={(event,node,items)=>{props.onNodeDragStop?.(event,node,items);dragging.current=null;}} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={nodes} onNodesChange={changeNodes}/></div>;
}
