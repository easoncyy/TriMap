import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLORATION_VERSION,
  checkpointKey,
  emptyExploration,
  liveKey,
  loadExploration,
  mergeExploration,
  mirrorViewKey,
  parseExploration,
  readCheckpoint,
  writeCheckpoint,
  writeExploration,
  type ExplorationState,
} from '../src/lib/exploration.ts';

const memory = (seed: Record<string, string> = {}) => {
  const data = {...seed};
  return {
    data,
    read: (key: string) => data[key] ?? null,
    write: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

const base: ExplorationState = {
  ...emptyExploration(),
  lens: 'ecology',
  focus: 'libero',
  prismMode: 'refraction',
  positions: {libero: {x: 10, y: 20}},
};

test('a malformed payload is ignored instead of trusted', () => {
  assert.equal(parseExploration(null), null);
  assert.equal(parseExploration('{'), null);
  assert.equal(parseExploration('[]'), null);
  assert.equal(parseExploration('"text"'), null);
});

test('partial payloads keep valid fields and default the rest', () => {
  const parsed = parseExploration(JSON.stringify({lens: 'unknown', focus: '', prismMode: 'refraction', positions: {a: {x: 1, y: 2}, b: {x: 'nope'}}}));
  assert.ok(parsed);
  assert.equal(parsed.version, EXPLORATION_VERSION);
  assert.equal(parsed.lens, 'domain');
  assert.equal(parsed.focus, 'task');
  assert.equal(parsed.prismMode, 'refraction');
  assert.deepEqual(parsed.positions, {a: {x: 1, y: 2}});
});

test('malformed mirrors and roots are dropped', () => {
  const parsed = parseExploration(
    JSON.stringify({
      roots: {domain: 'task', ecology: 42, unknown: 'x'},
      mirrors: [
        {id: 'm1', edgeId: 'r1', view: 'domain:dispersion', position: {x: 1, y: 2}, angle: 30},
        {id: 'm2', edgeId: 'r2', view: 'domain:dispersion', position: {x: 1}},
        {id: 'm3', edgeId: 'r3', position: {x: 1, y: 2}, angle: 0},
      ],
    }),
  );
  assert.ok(parsed);
  assert.deepEqual(parsed.roots, {domain: 'task'});
  assert.deepEqual(parsed.mirrors.map(m => m.id), ['m1']);
  assert.equal(parsed.mirrors[0].angle, 30);
});

test('legacy merge keeps layout from the view key and optics from the optics key', () => {
  const view = parseExploration(JSON.stringify({focus: 'task', lens: 'domain', positions: {task: {x: 5, y: 6}}, roots: {domain: 'task'}}));
  const optics = parseExploration(JSON.stringify({focus: 'vision', lens: 'ecology', prismMode: 'refraction', refractedPositions: {'ecology:refraction:vision': {x: 7, y: 8}}, mirrors: []}));
  const merged = mergeExploration(view, optics);
  assert.ok(merged);
  assert.equal(merged.focus, 'vision');
  assert.equal(merged.lens, 'ecology');
  assert.equal(merged.prismMode, 'refraction');
  assert.deepEqual(merged.positions, {task: {x: 5, y: 6}});
  assert.deepEqual(merged.roots, {domain: 'task'});
  assert.deepEqual(merged.refractedPositions, {'ecology:refraction:vision': {x: 7, y: 8}});
  assert.equal(mergeExploration(null, null), null);
});

test('linking mirrors never share a namespace with the exploration view', () => {
  assert.equal(mirrorViewKey('domain', 'dispersion', false), 'domain:dispersion');
  assert.equal(mirrorViewKey('domain', 'dispersion', true), 'domain:dispersion:linking');
  assert.equal(mirrorViewKey('cognition', 'refraction', true), 'cognition:refraction:linking');
});

test('the live key wins and legacy keys only fill a missing state', () => {
  const store = memory({
    [liveKey('official')]: JSON.stringify({...base, focus: 'live'}),
    [checkpointKey('official')]: JSON.stringify({...base, focus: 'checkpoint'}),
    'spectrum-view:official': JSON.stringify({...base, focus: 'legacy-view'}),
  });
  assert.equal(loadExploration(store.read, 'official').focus, 'live');
  assert.equal(readCheckpoint(store.read, 'official')?.focus, 'checkpoint');
});

test('legacy payloads migrate without losing the older keys', () => {
  const store = memory({
    'spectrum-view:official': JSON.stringify({focus: 'vision', lens: 'ecology', mirrors: []}),
    'spectrum-optics:official': JSON.stringify({prismMode: 'refraction', focus: 'vision', lens: 'ecology'}),
  });
  const loaded = loadExploration(store.read, 'official');
  assert.equal(loaded.focus, 'vision');
  assert.equal(loaded.lens, 'ecology');
  assert.equal(loaded.prismMode, 'refraction');
  assert.ok(store.data['spectrum-view:official'], 'legacy keys stay readable for rollback');
});

test('live and checkpoint writes are scoped per atlas and carry a version', () => {
  const store = memory();
  writeExploration(store.write, 'abc', base);
  writeCheckpoint(store.write, 'abc', base);
  assert.ok(store.data[liveKey('abc')]);
  assert.ok(store.data[checkpointKey('abc')]);
  assert.equal(store.data[liveKey('other')], undefined);
  assert.equal(JSON.parse(store.data[liveKey('abc')]).version, EXPLORATION_VERSION);
  assert.equal(parseExploration(store.data[checkpointKey('abc')])?.lens, 'ecology');
});

test('an empty store produces a usable default view', () => {
  const loaded = loadExploration(memory().read, 'official');
  assert.deepEqual(loaded, emptyExploration());
});

test('fold overrides persist per map while rejecting malformed entries',()=>{const state=parseExploration(JSON.stringify({folds:{'domain:dispersion:task':{ab:true,bc:false,bad:3},invalid:3}}));assert.deepEqual(state?.folds,{'domain:dispersion:task':{ab:true,bc:false}});});

test('layout provenance survives storage without confusing automatic and manual mirrors',()=>{const state=parseExploration(JSON.stringify({layoutVersion:2,manualPositions:['a',7],positions:{a:{x:20,y:30}},mirrors:[{id:'m',edgeId:'e',view:'domain:dispersion',position:{x:10,y:10},angle:0,manual:true}]}));assert.equal(state?.layoutVersion,2);assert.deepEqual(state?.manualPositions,['a']);assert.equal(state?.mirrors[0].manual,true);assert.deepEqual(state?.positions.a,{x:20,y:30});});
