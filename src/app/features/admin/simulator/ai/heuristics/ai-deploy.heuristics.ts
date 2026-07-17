import { hexKey, type BattleState, type CpuLevel, type PlayerId } from '../../../../../shared/types/battle.types';
import { hexNeighbors } from '../../../../../shared/components/hex-map/hex-map.types';
import type { CriterionChoice } from '../../simulator-play.utils';
import { buildHexIndex, hexDistance, isTraversable } from '../../engine/pathfinding';
import { objectiveBias, type AiObjective } from '../ai-objectives';
import { pickRandom, type RandomFn } from '../ai.types';
import { parseHex } from './ai-scoring';

const CRITERIA: CriterionChoice[] = ['junior-1', 'junior-2', 'ppt'];

/** Criterio de inicio del despliegue.
 *  N1: aleatorio. N2/N3: 'ppt' (junior requiere acuerdo mutuo, sin valor unilateral). */
export function chooseCriterion(level: CpuLevel, rand: RandomFn): CriterionChoice {
  if (level === 1) return pickRandom(CRITERIA, rand);
  return 'ppt';
}

/** Hex donde desplegar el bot pendiente. Options = claves "q,r" legales
 *  (el perímetro de seguridad respecto a enemigos ya viene filtrado).
 *  N1: aleatorio.
 *  N2: cohesión con los aliados colocados + tirar hacia el centro del mapa
 *      (donde ocurre el combate — evita empezar arrinconado).
 *  N3: además no regala posición (distancia a enemigos colocados) y busca
 *      cobertura: pegarse a obstáculos corta líneas de visión enemigas. */
export function chooseDeployHex(
  state: BattleState,
  player: PlayerId,
  options: string[],
  level: CpuLevel,
  objectives: AiObjective[],
  rand: RandomFn,
): string {
  if (level === 1) return pickRandom(options, rand);

  const placedAllies = state.bots.filter(b => b.playerId === player && b.q !== -999);
  const placedEnemies = state.bots.filter(b => b.playerId !== player && b.q !== -999);
  const centroid = (bots: typeof placedAllies) => ({
    q: bots.reduce((s, b) => s + b.q, 0) / bots.length,
    r: bots.reduce((s, b) => s + b.r, 0) / bots.length,
  });
  const mapCenter = state.hexMap.hexes.length > 0
    ? centroid(state.hexMap.hexes.map(h => ({ q: h.q, r: h.r })) as typeof placedAllies)
    : { q: 0, r: 0 };
  const anchor = placedAllies.length > 0 ? centroid(placedAllies) : mapCenter;
  const idx = buildHexIndex(state.hexMap);

  /** Obstáculos adyacentes (hexes del mapa no transitables): cobertura de LOS. */
  const coverAt = (q: number, r: number): number => {
    let cover = 0;
    for (const nb of hexNeighbors(q, r)) {
      const cell = idx.get(hexKey(nb.q, nb.r));
      if (cell && !isTraversable(cell, state.hexMap)) cover++;
    }
    return Math.min(cover, 2);
  };

  let best = options[0];
  let bestScore = -Infinity;
  for (const k of options) {
    const { q, r } = parseHex(k);
    let score = -hexDistance(q, r, Math.round(anchor.q), Math.round(anchor.r)) * 2
      - hexDistance(q, r, Math.round(mapCenter.q), Math.round(mapCenter.r)) * 0.4;
    if (level === 3) {
      if (placedEnemies.length > 0) {
        const dEnemy = Math.min(...placedEnemies.map(e => hexDistance(q, r, e.q, e.r)));
        score += Math.min(dEnemy, 9) * 0.5;
      }
      score += coverAt(q, r) * 0.6;
    }
    score += objectiveBias(objectives, { kind: 'deploy', botId: '', hex: { q, r } });
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}
