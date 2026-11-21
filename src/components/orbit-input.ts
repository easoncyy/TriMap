import type {ReactFlowInstance, Viewport} from '@xyflow/react';
import {zoomAround} from '../lib/graph-zoom';

type Contact = {clientX: number; clientY: number};
function pair(a: Contact, b: Contact) {
  const dx = b.clientX - a.clientX, dy = b.clientY - a.clientY;
  return {angle: Math.atan2(dy, dx), length: Math.max(1, Math.hypot(dx, dy)), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2};
}

type SafariGesture = Event & {rotation: number; scale: number; clientX: number; clientY: number};

/** Own two-contact sequences; React Flow still owns single-contact navigation. */
export function bindOrbitInput(host: HTMLElement, flow: ReactFlowInstance, minZoom: number, maxZoom: number,
  rotate: (delta: number) => void, finish: () => void, moving: () => void, interruptDrag: () => void,
  endViewport: (anchor: {x: number; y: number}, snap: boolean) => void) {
  const abort = new AbortController();
  const options = {capture: true, passive: false, signal: abort.signal};
  let start: ReturnType<typeof pair> | null = null;
  let previous = 0, turn = 0, mode: 'pending' | 'orbit' | 'viewport' = 'pending';
  let view: Viewport, native = false, mouse: {id: number; x: number} | null = null;
  let frame = 0, latest: ReturnType<typeof pair> | null = null;
  let origin = {x: 0, y: 0}, anchor = {x: 0, y: 0}, scaled = false;
  let suppressClickUntil = 0, remainingFinger = false;
  let wheelEnd: ReturnType<typeof setTimeout> | undefined;
  let pointerInPlot = false;
  const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,input,select,a,.react-flow__controls');
  host.addEventListener('pointermove', e => {pointerInPlot=!isControl(e.target);}, options);
  host.addEventListener('pointerleave', () => {pointerInPlot=false;}, options);
  const consume = (event: Event) => {if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();};
  const overGraph = (e: Event) => e.target instanceof Element && host.contains(e.target) && !isControl(e.target);
  function begin(sample: NonNullable<typeof start>) {
    const box = host.getBoundingClientRect();
    origin = {x: box.left, y: box.top};
    scaled = false;
    remainingFinger = false;
    start = sample; previous = sample.angle; turn = 0; mode = 'pending'; view = flow.getViewport();
  }
  function applyViewport() {
    frame = 0;
    if (!start || !latest) return;
    const zoom = Math.min(maxZoom, Math.max(minZoom, view.zoom * latest.length / start.length));
    anchor = {x: latest.x - origin.x, y: latest.y - origin.y};
    const from = {x: start.x - origin.x, y: start.y - origin.y};
    void flow.setViewport(zoomAround(view, zoom, from, anchor));
    latest = null;
  }
  function move(sample: NonNullable<typeof start>) {
    if (!start) return;
    const delta = Math.atan2(Math.sin(sample.angle - previous), Math.cos(sample.angle - previous));
    previous = sample.angle; turn += delta;
    const ratio = sample.length / start.length;
    if (mode === 'pending' || (mode === 'viewport' && Math.abs(turn) > Math.PI/24 && Math.abs(Math.log(ratio)) < .08)) {
      if (Math.abs(turn) >= Math.PI / 45) {
        if (mode === 'viewport') {cancelAnimationFrame(frame); applyViewport(); endViewport(anchor,false);}
        mode = 'orbit';
      }
      else if (Math.abs(Math.log(ratio)) > .01 || Math.hypot(sample.x-start.x,sample.y-start.y) > 8) mode = 'viewport';
      else return;
      if (mode === 'orbit') {rotate(turn); return;}
    }
    if (mode === 'orbit') {rotate(delta); return;}
    scaled ||= Math.abs(Math.log(ratio)) > .01;
    moving();
    latest = sample;
    if (!frame) frame = requestAnimationFrame(applyViewport);
  }
  function end(cancelled = false) {
    if (mode === 'orbit') finish();
    if (mode === 'viewport') {
      cancelAnimationFrame(frame);
      applyViewport();
      endViewport(anchor, scaled && !cancelled);
    }
    start = null;
    native = false;
    suppressClickUntil = performance.now() + 300;
  }
  host.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && overGraph(e)) {
      if (start) end(true);
      interruptDrag();
      native = false;
      begin(pair(e.touches[0],e.touches[1]));
    }
    if (start) consume(e);
  }, options);
  host.addEventListener('touchmove', e => {
    if (remainingFinger) {consume(e); return;}
    if (!start || native) return;
    consume(e);
    if (e.touches.length === 2) move(pair(e.touches[0],e.touches[1]));
  }, options);
  // Let the underlying one-finger handler receive its terminating touchend.
  const touchEnd = (e: TouchEvent) => {
    if (start && !native && e.touches.length < 2) {
      remainingFinger = e.touches.length === 1;
      end(e.type === 'touchcancel');
    }
    if (!e.touches.length) remainingFinger = false;
  };
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
    let {clientX: x, clientY: y} = e;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (start) {x = start.x; y = start.y;}
      else {
        const box = host.getBoundingClientRect();
        x = box.left + box.width / 2;
        y = box.top + box.height / 2;
      }
    }
    if (name === 'gesturestart') {interruptDrag(); native = true; begin({x,y,angle:0,length:1});}
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
  return () => {clearTimeout(wheelEnd); abort.abort(); cancelAnimationFrame(frame);};
}
