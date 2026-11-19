import type {ReactFlowInstance, Viewport} from '@xyflow/react';

type Contact = {clientX: number; clientY: number};
function pair(a: Contact, b: Contact) {
  const dx = b.clientX - a.clientX, dy = b.clientY - a.clientY;
  return {angle: Math.atan2(dy, dx), length: Math.max(1, Math.hypot(dx, dy)), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2};
}

type SafariGesture = Event & {rotation: number; scale: number; clientX: number; clientY: number};

/** Own two-contact sequences; React Flow still owns single-contact navigation. */
export function bindOrbitInput(host: HTMLElement, flow: ReactFlowInstance, minZoom: number, maxZoom: number,
  rotate: (delta: number) => void, finish: () => void, moving: () => void, interruptDrag: () => void) {
  const abort = new AbortController();
  const options = {capture: true, passive: false, signal: abort.signal};
  let start: ReturnType<typeof pair> | null = null;
  let previous = 0, turn = 0, mode: 'pending' | 'orbit' | 'viewport' = 'pending';
  let view: Viewport, native = false, mouse: {id: number; x: number} | null = null;
  let suppressClickUntil = 0;
  let wheelEnd: ReturnType<typeof setTimeout> | undefined;
  let pointerInPlot = false;
  const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,input,select,a,.react-flow__controls');
  host.addEventListener('pointermove', e => {pointerInPlot=!isControl(e.target);}, options);
  host.addEventListener('pointerleave', () => {pointerInPlot=false;}, options);
  const consume = (event: Event) => {if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();};
  const overGraph = (e: Event) => e.target instanceof Element && host.contains(e.target) && !isControl(e.target);
  function begin(sample: NonNullable<typeof start>) {
    start = sample; previous = sample.angle; turn = 0; mode = 'pending'; view = flow.getViewport();
  }
  function move(sample: NonNullable<typeof start>) {
    if (!start) return;
    const delta = Math.atan2(Math.sin(sample.angle - previous), Math.cos(sample.angle - previous));
    previous = sample.angle; turn += delta;
    const ratio = sample.length / start.length;
    if (mode === 'pending' || (mode === 'viewport' && Math.abs(turn) > Math.PI/24)) {
      if (Math.abs(turn) >= Math.PI / 45) mode = 'orbit';
      else if (Math.abs(Math.log(ratio)) > .05 || Math.hypot(sample.x-start.x,sample.y-start.y) > 8) mode = 'viewport';
      else return;
      if (mode === 'orbit') {rotate(turn); return;}
    }
    if (mode === 'orbit') {rotate(delta); return;}
    const box = host.getBoundingClientRect();
    const zoom = Math.min(maxZoom, Math.max(minZoom, view.zoom * ratio));
    const factor = zoom / view.zoom;
    moving();
    void flow.setViewport({zoom, x: sample.x-box.left-(start.x-box.left-view.x)*factor, y: sample.y-box.top-(start.y-box.top-view.y)*factor});
  }
  function end() {if (mode === 'orbit') finish(); start = null; native = false; suppressClickUntil = performance.now()+300;}
  host.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && overGraph(e)) {
      if (start && mode === 'orbit') finish();
      interruptDrag();
      native = false;
      begin(pair(e.touches[0],e.touches[1]));
    }
    if (start) consume(e);
  }, options);
  host.addEventListener('touchmove', e => {
    if (!start || native) return;
    consume(e);
    if (e.touches.length === 2) move(pair(e.touches[0],e.touches[1]));
  }, options);
  // Let the underlying one-finger handler receive its terminating touchend.
  const touchEnd = (e: TouchEvent) => {if (start && !native && !e.touches.length) end();};
  host.addEventListener('touchend', touchEnd, options);
  host.addEventListener('touchcancel', touchEnd, options);
  for (const name of ['gesturestart','gesturechange','gestureend']) document.addEventListener(name, event => {
    const e = event as SafariGesture;
    // Safari can target document or a compositor overlay instead of the pane.
    const hit = Number.isFinite(e.clientX) && Number.isFinite(e.clientY) ? document.elementFromPoint(e.clientX,e.clientY) : null;
    const inside = overGraph(e) || (hit && host.contains(hit) && !isControl(hit)) || (e.target===document && pointerInPlot);
    if (!native && !inside) return;
    consume(e);
    if (start && !native) return; // iOS also sends touch events.
    const box = host.getBoundingClientRect();
    const x = Number.isFinite(e.clientX) ? e.clientX : box.left+box.width/2;
    const y = Number.isFinite(e.clientY) ? e.clientY : box.top+box.height/2;
    if (name === 'gesturestart') {native = true; begin({x,y,angle:0,length:1});}
    if (name === 'gesturechange' && native) move({x,y,angle:(e.rotation||0)*Math.PI/180,length:e.scale||1});
    if (name === 'gestureend' && native) end();
  }, options);
  host.addEventListener('wheel', e => {
    if (!overGraph(e)) return;
    if (native) {consume(e); return;}
    // Chromium exposes trackpad scroll deltas but no physical twist angle.
    // Keep pinch (Ctrl+wheel) and vertical wheel zoom with React Flow.
    if (e.ctrlKey || e.metaKey || !e.deltaX || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    consume(e);
    const unit = e.deltaMode===1 ? 16 : e.deltaMode===2 ? host.clientWidth : 1;
    rotate(e.deltaX * unit * .007);
    clearTimeout(wheelEnd);
    wheelEnd=setTimeout(finish,120);
  }, options);
  host.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || !e.altKey || e.button !== 0 || !(e.target instanceof Element) || !e.target.closest('.react-flow__pane') || e.target.closest('.react-flow__node')) return;
    consume(e); mouse = {id:e.pointerId,x:e.clientX}; host.setPointerCapture(e.pointerId);
  }, options);
  host.addEventListener('pointermove', e => {
    if (mouse?.id !== e.pointerId) return;
    consume(e); rotate((e.clientX-mouse.x)*.012); mouse.x=e.clientX;
  }, options);
  const endMouse = (e: PointerEvent) => {if (mouse?.id===e.pointerId) {mouse=null; finish(); suppressClickUntil=performance.now()+300;}};
  host.addEventListener('pointerup', endMouse, options);
  host.addEventListener('lostpointercapture', endMouse, options);
  host.addEventListener('click', e => {if (performance.now()<suppressClickUntil && overGraph(e)) consume(e);}, options);
  return () => {clearTimeout(wheelEnd);abort.abort();};
}
