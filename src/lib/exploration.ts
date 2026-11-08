import type {Mirror,OpticalMode,Point} from './optics.ts';
import type {Lens} from './model.ts';

/** Bump when the persisted shape changes; older payloads fall back to defaults. */
export const EXPLORATION_VERSION = 1;

export type ExplorationState = {
  version: number;
  lens: Lens;
  focus: string;
  roots: Partial<Record<Lens, string>>;
  mirrors: Mirror[];
  positions: Record<string, Point>;
  refractedPositions: Record<string, Point>;
  prismMode: OpticalMode;
};

export type ReadStorage = (key: string) => string | null;
export type WriteStorage = (key: string, value: string) => void;

export function emptyExploration(): ExplorationState {
  return {
    version: EXPLORATION_VERSION,
    lens: 'domain',
    focus: 'task',
    roots: {},
    mirrors: [],
    positions: {},
    refractedPositions: {},
    prismMode: 'dispersion',
  };
}

export const liveKey = (id: string) => `spectrum-exploration:${id}`;
export const checkpointKey = (id: string) => `spectrum-exploration-checkpoint:${id}`;
export const legacyOpticsKey = (id: string) => `spectrum-optics:${id}`;
export const legacyViewKeys = (id: string) =>
  id === 'official' ? [`spectrum-view:${id}`, 'spectrum-view'] : [`spectrum-view:${id}`];

/**
 * Mirror placements are namespaced by view. Exploration keys keep the historical
 * `lens:mode` form so previously saved mirrors still match; the linking canvas
 * gets its own namespace because it lays the three maps side by side.
 */
export function mirrorViewKey(lens: Lens, mode: OpticalMode, linking: boolean) {
  return linking ? `${lens}:${mode}:linking` : `${lens}:${mode}`;
}

const lensIds: Lens[] = ['domain', 'ecology', 'cognition'];

function isLens(value: unknown): value is Lens {
  return typeof value === 'string' && (lensIds as string[]).includes(value);
}

function isMode(value: unknown): value is OpticalMode {
  return value === 'dispersion' || value === 'refraction';
}

function asPoint(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null;
  const point = value as {x?: unknown; y?: unknown};
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    ? {x: point.x as number, y: point.y as number}
    : null;
}

function asPoints(value: unknown): Record<string, Point> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([id, raw]) => {
      const point = asPoint(raw);
      return point ? [[id, point]] : [];
    }),
  );
}

function asRoots(value: unknown): Partial<Record<Lens, string>> {
  if (!value || typeof value !== 'object') return {};
  const roots: Partial<Record<Lens, string>> = {};
  for (const [key, id] of Object.entries(value as Record<string, unknown>)) {
    if (isLens(key) && typeof id === 'string' && id) roots[key] = id;
  }
  return roots;
}

function asMirrors(value: unknown): Mirror[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const mirror = item as Record<string, unknown>;
    const position = asPoint(mirror.position);
    if (
      typeof mirror.id !== 'string' ||
      typeof mirror.edgeId !== 'string' ||
      typeof mirror.view !== 'string' ||
      !position ||
      !Number.isFinite(mirror.angle)
    )
      return [];
    const targetId = typeof mirror.targetId === 'string' ? mirror.targetId : undefined;
    return [{id: mirror.id, edgeId: mirror.edgeId, view: mirror.view, position, angle: mirror.angle as number, ...(targetId ? {targetId} : {})}];
  });
}

/** Tolerant parse: unknown fields are dropped and a bad payload yields null. */
export function parseExploration(raw: string | null): ExplorationState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const parsed = data as Record<string, unknown>;
  const base = emptyExploration();
  return {
    version: EXPLORATION_VERSION,
    lens: isLens(parsed.lens) ? parsed.lens : base.lens,
    focus: typeof parsed.focus === 'string' && parsed.focus ? parsed.focus : base.focus,
    roots: asRoots(parsed.roots),
    mirrors: asMirrors(parsed.mirrors),
    positions: asPoints(parsed.positions),
    refractedPositions: asPoints(parsed.refractedPositions),
    prismMode: isMode(parsed.prismMode) ? parsed.prismMode : base.prismMode,
  };
}

/** The older build wrote layout and optics to two keys with different coverage. */
export function mergeExploration(
  view: ExplorationState | null,
  optics: ExplorationState | null,
): ExplorationState | null {
  if (!view && !optics) return null;
  const base = view ?? emptyExploration();
  if (!optics) return base;
  return {
    ...base,
    lens: optics.lens,
    focus: optics.focus,
    roots: Object.keys(optics.roots).length ? optics.roots : base.roots,
    mirrors: optics.mirrors.length ? optics.mirrors : base.mirrors,
    positions: Object.keys(optics.positions).length ? optics.positions : base.positions,
    refractedPositions: optics.refractedPositions,
    prismMode: optics.prismMode,
  };
}

export function loadExploration(read: ReadStorage, id: string): ExplorationState {
  const live = parseExploration(read(liveKey(id)));
  if (live) return live;
  const view = legacyViewKeys(id)
    .map(key => parseExploration(read(key)))
    .find((state): state is ExplorationState => !!state) ?? null;
  const optics = parseExploration(read(legacyOpticsKey(id)));
  return mergeExploration(view, optics) ?? emptyExploration();
}

export function readCheckpoint(read: ReadStorage, id: string): ExplorationState | null {
  return parseExploration(read(checkpointKey(id)));
}

export function writeExploration(write: WriteStorage, id: string, state: ExplorationState) {
  write(liveKey(id), JSON.stringify({...state, version: EXPLORATION_VERSION}));
}

export function writeCheckpoint(write: WriteStorage, id: string, state: ExplorationState) {
  write(checkpointKey(id), JSON.stringify({...state, version: EXPLORATION_VERSION}));
}
