'use client';
import {useEffect} from 'react';
import {ReactFlow,useNodesState,type ReactFlowProps} from '@xyflow/react';

/** Keep React Flow's measured dimensions and drag state inside the canvas.
 * The application only persists completed drags, not every pointer movement.
 */
export default function GraphCanvas({nodes:incoming=[],...props}:ReactFlowProps){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 useEffect(()=>{
  setNodes(previous=>incoming.map(node=>{
   const existing=previous.find(item=>item.id===node.id);
   return existing?{...existing,...node,measured:existing.measured}:node;
  }));
 },[incoming,setNodes]);
 return <ReactFlow {...props} nodes={nodes} onNodesChange={onNodesChange}/>;
}
