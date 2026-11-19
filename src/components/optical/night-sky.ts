// The hot spot and both rotating textures share a single pointer anchor.
export function mountNightSky(host:HTMLElement) {
 const halo=host.querySelector<HTMLElement>('.cursor-bloom')!;
 const fine=matchMedia('(any-hover:hover) and (any-pointer:fine)');
 let bounds:DOMRect|null=null,inside=false;
 function leave(){
  inside=false;bounds=null;
  host.classList.remove('pointer-in-sky');
 }
 function move(event:PointerEvent){
  if(event.pointerType==='touch'||!fine.matches||
     (event.target as Element)?.closest('.react-flow__controls,.overview-note,.react-flow__attribution')){
   if(inside)leave();
   return;
  }
  bounds??=host.getBoundingClientRect();
  halo.style.transform=`translate3d(${event.clientX-bounds.left}px,${event.clientY-bounds.top}px,0)`;
  if(!inside){inside=true;host.classList.add('pointer-in-sky');}
 }
 const invalidate=()=>{bounds=null;};
 const observer=new ResizeObserver(invalidate);observer.observe(host);
 host.addEventListener('pointermove',move,{passive:true});
 host.addEventListener('pointerleave',leave);
 host.addEventListener('pointercancel',leave);
 window.addEventListener('scroll',invalidate,true);
 window.addEventListener('blur',leave);
 fine.addEventListener('change',leave);
 return ()=>{
  leave();observer.disconnect();
  host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave);
  host.removeEventListener('pointercancel',leave);window.removeEventListener('scroll',invalidate,true);
  window.removeEventListener('blur',leave);fine.removeEventListener('change',leave);
 };
}
