import assert from 'node:assert/strict';
import {test} from 'node:test';
import {labelScale, zoomAround, zoomStop} from '../src/lib/graph-zoom.ts';

test('zoom settles on the nearest logarithmic stop, including the clipped limits', () => {
  const nearest = (value: number) => zoomStop(value, .02, 1.8);
  assert.equal(nearest(1.11), 1);
  assert.equal(nearest(1.12), 1.25);
  assert.equal(nearest(1.52), 1.5625);
  assert.equal(nearest(1.79), 1.8);
  assert.equal(nearest(.0201), .02);
  assert.equal(zoomStop(1.8, .02, 1.8, -1), 1.5625);
  assert.equal(zoomStop(.02, .02, 1.8, -1), .02);
  assert.equal(zoomStop(.91, .02, 1.8, 1), 1);
});

test('title pixels interpolate between stops and stay readable at the limits', () => {
  for (const [zoom, px] of [[.02,12],[.8,13],[1,14],[1.25,15],[1.5625,16],[Math.sqrt(1.25),14.5],[8,17]]) {
    assert.ok(Math.abs(labelScale(zoom) * zoom * 14 - px) < 1e-9);
  }
});

test('the same world point stays under a moving pinch midpoint and during snap', () => {
  const view = {x: 40, y: -30, zoom: .8};
  const from = {x: 400, y: 150}, to = {x: 370, y: 170};
  const moved = zoomAround(view, 1.19, from, to);
  for (const next of [moved, zoomAround(moved, 1.25, to)]) {
    for (const axis of ['x','y'] as const) {
      assert.ok(Math.abs((to[axis]-next[axis])/next.zoom - (from[axis]-view[axis])/view.zoom) < 1e-9);
    }
  }
});
