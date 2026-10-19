/** Pure, fixed-coordinate physics. No battle resources, clocks, storage or random draws. */
export type WaterPoint = { x: number; y: number };
export type WaterSegment = { from: WaterPoint; to: WaterPoint; start: number; end: number };
export const WATER_BOARD = { width: 320, height: 360, inset: 12 } as const;
export const WATER_ORIGIN: WaterPoint = { x: 160, y: 310 };
export const WATER_SHOTS = 1;
export const WATER_FLIGHT_MS = 5000;
export const WATER_SPEED = 580;
export const WATER_GUIDE_TAIL = 32;
export const WATER_BALL_RADIUS = 9;
export const WATER_BUBBLE_COUNT = 12;
export type WaterBubble = WaterPoint & { id: number; radius: number };
/** Seeded placement is independent of battle RNG and stable throughout a cast. */
export function createWaterBubbles(seed: number): WaterBubble[] {
  let value = (seed >>> 0) || 1;
  const random = () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
  const bubbles: WaterBubble[] = [];
  for (let attempt = 0; attempt < 2000 && bubbles.length < WATER_BUBBLE_COUNT; attempt++) {
    const p = { x: 40 + random() * 240, y: 58 + random() * 204 };
    if (bubbles.every(b => Math.hypot(b.x - p.x, b.y - p.y) >= 50)) bubbles.push({ ...p, id: bubbles.length, radius: 22 });
  }
  // Bounded fallback also varies each cast; never hangs on a crowded placement.
  if (bubbles.length < WATER_BUBBLE_COUNT) return [64, 124, 184, 244].flatMap((y, row) =>
    [65, 160, 255].map((x, col) => ({ id: row * 3 + col, x: x + (random() - .5) * 30, y: y + (random() - .5) * 12, radius: 22 })));
  return bubbles;
}
/** Visual displacement only. Actual flight always starts at the launch ring. */
export function waterPullPosition(delta: WaterPoint): WaterPoint {
  if (!finite(delta)) return { ...WATER_ORIGIN };
  const length = Math.hypot(delta.x, delta.y);
  if (!Number.isFinite(length)) return { ...WATER_ORIGIN };
  const scale = length > 58 ? 58 / length : 1;
  return { x: Math.max(22, Math.min(298, WATER_ORIGIN.x + delta.x * scale)), y: Math.max(22, Math.min(338, WATER_ORIGIN.y + delta.y * scale)) };
}
export type WaterSlingState = {
  phase: 'ready' | 'flight' | 'done'; shots: number; popped: number[];
  elapsed: number; path: WaterSegment[]; ball: WaterPoint; bubbles: WaterBubble[];
};
const finite = (p: WaterPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
export function waterDirection(from: WaterPoint, pull: WaterPoint): WaterPoint | null {
  if (!finite(from) || !finite(pull)) return null;
  const x = from.x - pull.x, y = from.y - pull.y, length = Math.hypot(x, y);
  return !Number.isFinite(length) || length < 8 ? null : { x: x / length, y: y / length };
}
function normalize(direction: WaterPoint): WaterPoint | null {
  const length = Math.hypot(direction.x, direction.y);
  return !finite(direction) || !Number.isFinite(length) || length < 1e-8 ? null : { x: direction.x / length, y: direction.y / length };
}
function nextWall(p: WaterPoint, d: WaterPoint) {
  const { width, height, inset } = WATER_BOARD;
  const tx = Math.abs(d.x) < 1e-9 ? Infinity : ((d.x > 0 ? width - inset : inset) - p.x) / d.x;
  const ty = Math.abs(d.y) < 1e-9 ? Infinity : ((d.y > 0 ? height - inset : inset) - p.y) / d.y;
  const distance = Math.min(tx, ty);
  return { distance: Math.max(0, distance), x: Math.abs(tx - distance) < 1e-6, y: Math.abs(ty - distance) < 1e-6 };
}
/** At most one visible bounce: full first leg, then a short tail, never a second wall. */
export function waterGuide(direction: WaterPoint): WaterPoint[] {
  const d = normalize(direction); if (!d) return [];
  const wall = nextWall(WATER_ORIGIN, d);
  const contact = { x: WATER_ORIGIN.x + d.x * wall.distance, y: WATER_ORIGIN.y + d.y * wall.distance };
  const reflected = { x: wall.x ? -d.x : d.x, y: wall.y ? -d.y : d.y };
  const tail = Math.min(WATER_GUIDE_TAIL, nextWall(contact, reflected).distance);
  return [{ ...WATER_ORIGIN }, contact, { x: contact.x + reflected.x * tail, y: contact.y + reflected.y * tail }];
}
export function waterShotPath(direction: WaterPoint): WaterSegment[] {
  let d = normalize(direction); if (!d) return [];
  let p = { ...WATER_ORIGIN }, distance = 0;
  const maxDistance = WATER_SPEED * WATER_FLIGHT_MS / 1000, path: WaterSegment[] = [];
  for (let step = 0; step < 32 && distance < maxDistance - 1e-7; step++) {
    const wall = nextWall(p, d), length = Math.min(wall.distance, maxDistance - distance);
    const end = { x: p.x + d.x * length, y: p.y + d.y * length };
    if (length > 1e-7) path.push({ from: p, to: end, start: distance, end: distance + length });
    distance += length; p = end;
    d = { x: wall.x ? -d.x : d.x, y: wall.y ? -d.y : d.y };
  }
  return path;
}
export function waterPosition(path: WaterSegment[], elapsed: number): WaterPoint {
  const distance = WATER_SPEED * Math.max(0, Math.min(WATER_FLIGHT_MS, Number.isFinite(elapsed) ? elapsed : 0)) / 1000;
  const segment = path.find(s => s.end >= distance) ?? path.at(-1);
  if (!segment) return { ...WATER_ORIGIN };
  const t = Math.max(0, Math.min(1, (distance - segment.start) / (segment.end - segment.start)));
  return { x: segment.from.x + (segment.to.x - segment.from.x) * t, y: segment.from.y + (segment.to.y - segment.from.y) * t };
}
function intersects(p: WaterPoint, a: WaterPoint, b: WaterPoint, radius: number) {
  const x = b.x - a.x, y = b.y - a.y, length2 = x * x + y * y;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / length2)) : 0;
  return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t) <= radius;
}
export function waterPopped(path: WaterSegment[], elapsed: number, bubbles: readonly WaterBubble[], previous: readonly number[] = []): number[] {
  const distance = WATER_SPEED * Math.max(0, Math.min(WATER_FLIGHT_MS, Number.isFinite(elapsed) ? elapsed : 0)) / 1000;
  const hits = new Set(previous.filter(id => bubbles.some(b => b.id === id)));
  for (const segment of path) {
    if (distance < segment.start) break;
    const end = waterPosition([segment], Math.min(distance, segment.end) / WATER_SPEED * 1000);
    for (const bubble of bubbles) if (intersects(bubble, segment.from, end, bubble.radius + WATER_BALL_RADIUS)) hits.add(bubble.id);
  }
  return [...hits].sort((a, b) => a - b);
}
export const waterSlingScore = (popped: readonly number[]) => Math.round(new Set(popped.filter(id => Number.isInteger(id) && id >= 0 && id < WATER_BUBBLE_COUNT)).size / WATER_BUBBLE_COUNT * 100);
export const createWaterSling = (seed = 1): WaterSlingState => ({ phase: 'ready', shots: 0, popped: [], elapsed: 0, path: [], ball: { ...WATER_ORIGIN }, bubbles: createWaterBubbles(seed) });
export function launchWaterSling(state: WaterSlingState, direction: WaterPoint): WaterSlingState {
  if (state.phase !== 'ready' || state.shots >= WATER_SHOTS) return state;
  const path = waterShotPath(direction); if (!path.length) return state;
  return { ...state, phase: 'flight', shots: state.shots + 1, elapsed: 0, path, ball: { ...WATER_ORIGIN } };
}
export function advanceWaterSling(state: WaterSlingState, elapsed: number): WaterSlingState {
  if (state.phase !== 'flight' || !Number.isFinite(elapsed)) return state;
  const next = Math.max(state.elapsed, Math.min(WATER_FLIGHT_MS, elapsed));
  const popped = waterPopped(state.path, next, state.bubbles, state.popped), complete = popped.length === state.bubbles.length;
  const phase = complete || next === WATER_FLIGHT_MS && state.shots === WATER_SHOTS ? 'done' : next === WATER_FLIGHT_MS ? 'ready' : 'flight';
  return { ...state, phase, popped, elapsed: next, ball: phase === 'ready' ? { ...WATER_ORIGIN } : waterPosition(state.path, next) };
}
