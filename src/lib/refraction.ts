export type Vec = { x: number; y: number };

/** Square drawing box so arbitrary rotation preserves angles. */
const SIZE = 120;
const CENTER: Vec = { x: SIZE / 2, y: SIZE / 2 + 2 };
const RADIUS = 50;

/**
 * Dispersion is exaggerated compared with real glass so the fan stays legible
 * at this size; ordering (red leaves nearest the axis, violet furthest) is physical.
 */
export const SPECTRUM = [
  {color: '#e0656f'},
  {color: '#e88a45'},
  {color: '#e2cf5f'},
  {color: '#7fbf8a'},
  {color: '#6c9fc9'},
  {color: '#a684cf'},
];

export type PrismTrace = {
  outline: Vec[];
  entry: Vec;
  start: Vec;
  /** Undeviated reference through the glass, so the bend itself is visible. */
  ghost: Vec[];
  rays: { color: string; path: Vec[] }[];
};

const add = (a: Vec, b: Vec): Vec => ({x: a.x + b.x, y: a.y + b.y});
const sub = (a: Vec, b: Vec): Vec => ({x: a.x - b.x, y: a.y - b.y});
const mul = (a: Vec, k: number): Vec => ({x: a.x * k, y: a.y * k});
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const unit = (v: Vec): Vec | null => {
  const length = Math.hypot(v.x, v.y);
  return length < 1e-6 ? null : {x: v.x / length, y: v.y / length};
};
const rotate = (v: Vec, radians: number): Vec => ({
  x: v.x * Math.cos(radians) - v.y * Math.sin(radians),
  y: v.x * Math.sin(radians) + v.y * Math.cos(radians),
});

type Face = {a: Vec; b: Vec; normal: Vec};

function triangle(facing: number): Vec[] {
  return [0, 1, 2].map(i => {
    const a = facing + (i * 2 * Math.PI) / 3 - Math.PI / 2;
    return {x: CENTER.x + Math.cos(a) * RADIUS, y: CENTER.y + Math.sin(a) * RADIUS};
  });
}

function facesOf(outline: Vec[]): Face[] {
  return outline.map((a, i) => {
    const b = outline[(i + 1) % 3];
    const d = sub(b, a);
    const outward = [{x: d.y, y: -d.x}, {x: -d.y, y: d.x}].find(n => dot(n, sub(CENTER, a)) < 0)!;
    return {a, b, normal: unit(outward) as Vec};
  });
}

const at = (face: Face, t: number): Vec => add(face.a, mul(sub(face.b, face.a), t));

/**
 * Rotate the glass so one face opposes the incoming ray and another faces the
 * downstream knowledge. Light then visibly bends at the entry face and the fan
 * leaves towards the next node instead of pointing away from the relation.
 */
function align(incoming: Vec, outgoing: Vec) {
  let best: {outline: Vec[]; faces: Face[]; entry: number; exit: number; score: number} | null = null;
  for (let step = 0; step < 180; step++) {
    const outline = triangle((step * Math.PI) / 90);
    const faces = facesOf(outline);
    let entry = 0;
    let exit = 0;
    faces.forEach((face, i) => {
      if (dot(face.normal, incoming) < dot(faces[entry].normal, incoming)) entry = i;
      if (dot(face.normal, outgoing) > dot(faces[exit].normal, outgoing)) exit = i;
    });
    if (entry === exit) {
      // Pick the second-best exit face when entry and exit collapse onto one.
      const others = [0, 1, 2].filter(i => i !== entry).sort((a, b) => dot(faces[b].normal, outgoing) - dot(faces[a].normal, outgoing));
      exit = others[0];
    }
    const score = -dot(faces[entry].normal, incoming) + dot(faces[exit].normal, outgoing);
    if (!best || score > best.score + 1e-9) best = {outline, faces, entry, exit, score};
  }
  return best!;
}

export function tracePrism(beam?: {in: Vec | null; out: Vec | null} | null): PrismTrace | null {
  const incoming = beam?.in ? unit(beam.in) : null;
  if (!incoming) return null;
  const raw = beam?.out ? unit(beam.out) : null;
  // A leaf node has no downstream stop; light continues forward instead of folding back.
  const outgoing = raw && dot(incoming, raw) > 0.25 ? raw : incoming;
  const {outline, faces, entry: entryIndex, exit: exitIndex} = align(incoming, outgoing);
  const entryFace = faces[entryIndex];
  const exitFace = faces[exitIndex];

  // Enter near the middle of the upstream face, so it reads as glass and not a vertex.
  const entry = at(entryFace, 0.5);
  const start = add(entry, mul(incoming, -44));

  // Undeviated reference: where the straight ray would leave the glass.
  const ghostEnd = at(exitFace, 0.5);
  const ghost = [entry, ghostEnd, add(ghostEnd, mul(incoming, 12))];

  const rays: PrismTrace['rays'] = [];
  SPECTRUM.forEach(({color}, i) => {
    // Colours fan across the exit face; red keeps closest to the outgoing axis.
    const spread = (i - 2.5) / 2.5;
    const exit = at(exitFace, 0.5 + spread * 0.17);
    const bend = rotate(exitFace.normal, spread * 0.13);
    rays.push({color, path: [entry, exit, add(exit, mul(bend, 26))]});
  });

  return {outline, entry, start, ghost, rays};
}
