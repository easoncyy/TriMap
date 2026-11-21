import type {Viewport} from '@xyflow/react';

const step = 1.25;
const logStep = Math.log(step);
type Point = {x: number; y: number};

/** Include the exact viewport limits even when they fall between two powers of 1.25. */
export function zoomStop(zoom: number, min: number, max: number, direction: -1 | 0 | 1 = 0) {
  const level = Math.log(zoom) / logStep;
  const clamp = (candidate: number) => Math.min(max, Math.max(min, candidate));
  // Allow for floating-point error when the current view is exactly on a stop.
  if (direction === 1) return clamp(step ** (Math.floor(level + 1e-8) + 1));
  if (direction === -1) return clamp(step ** (Math.ceil(level - 1e-8) - 1));
  const lower = clamp(step ** Math.floor(level));
  const upper = clamp(step ** Math.ceil(level));
  return zoom < Math.sqrt(lower * upper) ? lower : upper;
}

/** CSS scale inside the transformed viewport, calibrated to a 14px node title. */
export function labelScale(zoom: number) {
  const pixels = Math.min(17, Math.max(12, 14 + Math.log(zoom) / logStep));
  return pixels / (14 * zoom);
}

export function zoomAround(view: Viewport, zoom: number, from: Point, to = from): Viewport {
  const factor = zoom / view.zoom;
  return {zoom, x: to.x - (from.x - view.x) * factor, y: to.y - (from.y - view.y) * factor};
}
