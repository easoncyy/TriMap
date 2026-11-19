import {memo,useEffect,useRef} from 'react';
import {useStoreApi,type Node} from '@xyflow/react';

/** The orbits use graph coordinates, but their backing surface is viewport-sized.
 * A zoomed SVG gradient on the full orbital plane creates very large paint tiles in WebKit. */
export const PlanetaryOrbits=memo(function PlanetaryOrbits({nodes}:{nodes:Node[]}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const store=useStoreApi();
 const prisms=nodes.filter(node=>node.type==='spectral');
 const sun=prisms.find(node=>node.data.lightSource)||prisms.find(node=>node.selected)||prisms[0];
 const x=sun?.position.x??0,y=sun?.position.y??0;
 const distances=prisms.filter(node=>node!==sun).map(node=>{
  const dx=node.position.x-x,dy=node.position.y-y;
  return Math.hypot(.97*dx-.24*dy,(.24*dx+.97*dy)/.49);
 }).sort((a,b)=>a-b);
 const radius=Math.max(520,Math.min(3500,distances[Math.floor(distances.length*.66)]||900));
 const hasSun=!!sun;
 useEffect(()=>{
  const canvas=canvasRef.current,ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  let width=0,height=0,ratio=1;
  function draw(){
   if(!canvas||!ctx)return;
   ctx.resetTransform();
   ctx.clearRect(0,0,canvas.width,canvas.height);
   if(!hasSun||!width||!height)return;
   const [tx,ty,zoom]=store.getState().transform;
   const scale=zoom*ratio;
   ctx.setTransform(scale,0,0,scale,(tx+(x+100)*zoom)*ratio,(ty+(y+80)*zoom)*ratio);
   ctx.rotate(-14*Math.PI/180);
   for(const [i,k] of [.47,.82,1.18].entries()){
    const r=k*radius,ry=r*.49,cx=r*.065;
    const ink=ctx.createLinearGradient(cx-.84*r,-.8*ry,cx+.7*r,.84*ry);
    ink.addColorStop(0,'rgba(136,167,185,.30)');
    ink.addColorStop(.34,'rgba(179,198,200,.76)');
    ink.addColorStop(.55,'rgba(118,139,152,.32)');
    ink.addColorStop(1,'rgba(216,188,136,.77)');
    ctx.strokeStyle=ink;
    ctx.globalAlpha=i===1?.88:.72;
    ctx.lineWidth=i===1?3.2:2.2;
    ctx.setLineDash([]);
    ctx.beginPath();ctx.ellipse(cx,0,r,ry,0,0,2*Math.PI);ctx.stroke();
    if(i===1){
     ctx.globalAlpha=.58;ctx.lineWidth=1.8;ctx.setLineDash([3,21]);
     ctx.beginPath();ctx.ellipse(cx,0,r*1.019,ry*1.019,0,0,2*Math.PI);ctx.stroke();
    }
   }
  }
  function resize(){
   if(!canvas)return;
   width=canvas.clientWidth;height=canvas.clientHeight;
   ratio=Math.min(window.devicePixelRatio||1,1.5);
   const w=Math.round(width*ratio),h=Math.round(height*ratio);
   if(canvas.width!==w)canvas.width=w;
   if(canvas.height!==h)canvas.height=h;
   draw();
  }
  resize();
  let resizeFrame=0;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);});observer.observe(canvas);
  const unsubscribe=store.subscribe((next,prev)=>{if(next.transform!==prev.transform)draw();});
  return ()=>{observer.disconnect();cancelAnimationFrame(resizeFrame);unsubscribe();};
 },[store,x,y,radius,hasSun]);
 return <canvas ref={canvasRef} className="planetary-plane" aria-hidden="true"/>;
});
