import { Wayfinder, WayfinderError, type Cell, type CellEdit, type RouteResult, type WayfinderSnapshot } from '../dist/packages/wayfinder/index.js';
const grid = new Wayfinder({ width: 12, height: 10, diagonal: 'no-cut', origin: { x: -6, z: -5 } });
const start: Cell = { x: 0, z: 0 };
const edits: readonly CellEdit[] = [{ x: 3, z: 4, blocked: true }];
const revision: number = grid.setCells(edits);
const result: RouteResult = grid.findPath(start, { x: 11, z: 9 }, { y: 1.2, maxVisited: 50 });
const saved: WayfinderSnapshot = grid.snapshot();
const copy: Wayfinder = Wayfinder.fromSnapshot(saved);
const same: Wayfinder = copy.restore(saved);
const error: WayfinderError = new WayfinderError('INVALID_INPUT', 'example');
void [revision, result, same, error];
// @ts-expect-error invalid diagonal policy
new Wayfinder({ width: 2, height: 2, diagonal: 'sometimes' });
// @ts-expect-error XZ cells use z, not y
grid.findPath({ x: 0, y: 0 }, { x: 1, z: 1 });
// @ts-expect-error blocked is boolean
grid.setCell(start, { blocked: 1 });
