import type {Point} from './optics.ts';

// The released canvas already shows rings tipped to this angle and aspect.
// Lift its existing coordinates into that plane before turning them so zero
// degrees reproduces every saved layout, including hand-placed mirrors.
const skew = -14 * Math.PI / 180;
const c = Math.cos(skew), s = Math.sin(skew), aspect = .49;
export const fullTurn = 2 * Math.PI;
export function wrapOrbit(angle:number) {return ((angle % fullTurn) + fullTurn) % fullTurn;}
export const opticalOffset = (type?:string):Point => type==='mirror'?{x:38,y:38}:{x:100,y:80};

export function projectOrbit(point:Point, pivot:Point, angle:number) {
  const dx = point.x-pivot.x, dy = point.y-pivot.y;
  const x = c*dx+s*dy, y = (-s*dx+c*dy)/aspect;
  const rx = x*Math.cos(angle)-y*Math.sin(angle);
  const ry = x*Math.sin(angle)+y*Math.cos(angle);
  const focal = Math.max(1800, Math.hypot(x,y)/.23);
  return {
    x:pivot.x+c*rx-s*ry*aspect, y:pivot.y+s*rx+c*ry*aspect,
    scale:(1-y/focal)/(1-ry/focal), depth:ry,
  };
}
