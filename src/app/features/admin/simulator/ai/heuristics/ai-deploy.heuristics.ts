import type { BattleState, CpuLevel, PlayerId } from '../../../../../shared/types/battle.types';
import type { CriterionChoice } from '../../simulator-play.utils';
import { hexDistance } from '../../engine/pathfinding';
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
 *  N2: cohesión — junto a los aliados ya colocados (o el centro del mapa).
 *  N3: cohesión + no regalar posición (maximiza distancia a enemigos colocados). */
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

  let best = options[0];
  let bestScore = -Infinity;
  for (const k of options) {
    const { q, r } = parseHex(k);
    let score = -hexDistance(q, r, Math.round(anchor.q), Math.round(anchor.r)) * 2;
    if (level === 3 && placedEnemies.length > 0) {
      const dEnemy = Math.min(...placedEnemies.map(e => hexDistance(q, r, e.q, e.r)));
      score += Math.min(dEnemy, 9) * 0.5;
    }
    score += objectiveBias(objectives, { kind: 'deploy', botId: '', hex: { q, r } });
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}
