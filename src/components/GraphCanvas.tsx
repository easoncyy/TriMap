'use client';
import {useEffect,useRef,useState} from 'react';
import {ReactFlow,useNodesState,type ReactFlowProps,type ReactFlowInstance,type NodeChange} from '@xyflow/react';

/** Keep React Flow's measured dimensions and drag state inside the canvas.
 * The application only persists completed drags, not every pointer movement.
 */
export default function GraphCanvas({nodes:incoming=[],...props}:ReactFlowProps){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 const dragging=useRef<string|null>(null);
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
 return <div ref={container} style={{width:'100%',height:'100%',minHeight:0}}><ReactFlow {...props} onMove={(event,viewport)=>{container.current?.style.setProperty('--label-scale',String(Math.min(4,1/Math.max(.25,viewport.zoom))));props.onMove?.(event,viewport);}} multiSelectionKeyCode={null} selectionKeyCode={null} selectionOnDrag={false} onNodeDragStart={(event,node,items)=>{dragging.current=node.id;setNodes(ns=>ns.map(n=>({...n,selected:n.id===node.id})));props.onNodeDragStart?.(event,node,items);}} onNodeDragStop={(event,node,items)=>{props.onNodeDragStop?.(event,node,items);dragging.current=null;}} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={nodes} onNodesChange={changeNodes}/></div>;
}
