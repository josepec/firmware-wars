import { hexKey, type BattleBot } from '../../../../shared/types/battle.types';
import type { HexMapData } from '../../../../shared/components/hex-map/hex-map.types';
import { buildHexIndex, hexDistance, isTraversable } from '../engine/pathfinding';

/** Helpers para los rangos especiales (LR, SLDV, R(n)).
 *  TODO: implementar cada uno cuando integremos su primera función. */

/** SLDV — Sin Línea de Visión: hexes a distancia [min, max] ignorando bloqueos. */
export function sldvHexes(
  fromQ: number,
  fromR: number,
  rangeMin: number,
  rangeMax: number,
  map: HexMapData,
): Set<string> {
  const out = new Set<string>();
  for (const h of map.hexes) {
    const d = hexDistance(fromQ, fromR, h.q, h.r);
    if (d < rangeMin || d > rangeMax) continue;
    out.add(hexKey(h.q, h.r));
  }
  return out;
}

/** LR — Línea Recta: los 6 rayos cardinales del hex, interrumpidos por el primer
 *  obstáculo o Bot en la trayectoria. Solo hexes dentro de [rangeMin, rangeMax]. */
export function lrHexes(
  fromQ: number,
  fromR: number,
  rangeMin: number,
  rangeMax: number,
  map: HexMapData,
  bots: BattleBot[],
): Set<string> {
  const index = buildHexIndex(map);
  const botHexes = new Set<string>(bots.filter(b => !b.destroyed).map(b => hexKey(b.q, b.r)));
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const out = new Set<string>();
  for (const [dq, dr] of DIRS) {
    for (let step = 1; step <= rangeMax; step++) {
      const q = fromQ + dq * step;
      const r = fromR + dr * step;
      const k = hexKey(q, r);
      const cell = index.get(k);
      if (!cell || !isTraversable(cell, map)) break;
      if (step >= rangeMin) out.add(k);
      if (botHexes.has(k)) break; // first bot blocks further
    }
  }
  return out;
}

/** Splash R(n) — todos los hexes a distancia ≤ radius desde el punto de impacto. */
export function splashHexes(
  centerQ: number,
  centerR: number,
  radius: number,
  map: HexMapData,
): Set<string> {
  const out = new Set<string>();
  for (const h of map.hexes) {
    const d = hexDistance(centerQ, centerR, h.q, h.r);
    if (d > radius) continue;
    out.add(hexKey(h.q, h.r));
  }
  return out;
}
