import { hexKey, type BattleBot } from '../../../../shared/types/battle.types';
import { hexNeighbors, type HexCell, type HexMapData } from '../../../../shared/components/hex-map/hex-map.types';

export function hexDistance(aq: number, ar: number, bq: number, br: number): number {
  const as = -aq - ar;
  const bs = -bq - br;
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(as - bs)) / 2;
}

export function isTraversable(cell: HexCell | undefined, map: HexMapData): boolean {
  if (!cell) return false;
  const type = map.hexTypes.find(t => t.id === cell.typeId);
  if (!type) return true;
  return type.properties?.['traversable'] !== 'false';
}

export function buildHexIndex(map: HexMapData): Map<string, HexCell> {
  const idx = new Map<string, HexCell>();
  for (const h of map.hexes) idx.set(hexKey(h.q, h.r), h);
  return idx;
}

export function reachableHexes(
  fromQ: number,
  fromR: number,
  maxDistance: number,
  map: HexMapData,
  bots: BattleBot[],
  selfId?: string,
): Set<string> {
  const index = buildHexIndex(map);
  const blocked = new Set<string>();
  for (const b of bots) {
    if (b.destroyed) continue;
    if (b.id === selfId) continue;
    blocked.add(hexKey(b.q, b.r));
  }
  const visited = new Set<string>();
  const start = hexKey(fromQ, fromR);
  visited.add(start);
  let frontier: { q: number; r: number; d: number }[] = [{ q: fromQ, r: fromR, d: 0 }];
  const result = new Set<string>();
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const cur of frontier) {
      if (cur.d > 0) result.add(hexKey(cur.q, cur.r));
      if (cur.d === maxDistance) continue;
      for (const nb of hexNeighbors(cur.q, cur.r)) {
        const k = hexKey(nb.q, nb.r);
        if (visited.has(k)) continue;
        const cell = index.get(k);
        if (!isTraversable(cell, map)) continue;
        if (blocked.has(k)) continue;
        visited.add(k);
        next.push({ q: nb.q, r: nb.r, d: cur.d + 1 });
      }
    }
    frontier = next;
  }
  return result;
}

export function lineOfSight(
  fromQ: number,
  fromR: number,
  toQ: number,
  toR: number,
  map: HexMapData,
  bots: BattleBot[],
): boolean {
  const index = buildHexIndex(map);
  const blockers = new Set<string>();
  for (const b of bots) {
    if (b.destroyed) continue;
    blockers.add(hexKey(b.q, b.r));
  }
  const N = hexDistance(fromQ, fromR, toQ, toR);
  if (N === 0) return true;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const q = Math.round(fromQ + (toQ - fromQ) * t);
    const r = Math.round(fromR + (toR - fromR) * t);
    const k = hexKey(q, r);
    const cell = index.get(k);
    if (!isTraversable(cell, map)) return false;
    if (blockers.has(k)) return false;
  }
  return true;
}

export function attackableHexes(
  attackerQ: number,
  attackerR: number,
  range: number,
  map: HexMapData,
  bots: BattleBot[],
): Set<string> {
  const out = new Set<string>();
  for (const h of map.hexes) {
    const d = hexDistance(attackerQ, attackerR, h.q, h.r);
    if (d === 0 || d > range) continue;
    if (!lineOfSight(attackerQ, attackerR, h.q, h.r, map, bots)) continue;
    out.add(hexKey(h.q, h.r));
  }
  return out;
}

export function findClosestEnemy(
  fromBot: BattleBot,
  bots: BattleBot[],
): BattleBot | null {
  let best: BattleBot | null = null;
  let bestD = Infinity;
  for (const b of bots) {
    if (b.destroyed) continue;
    if (b.playerId === fromBot.playerId) continue;
    const d = hexDistance(fromBot.q, fromBot.r, b.q, b.r);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}
