import type { BattleBot, BattleState, PlayerId } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { hexDistance } from '../../engine/pathfinding';
import { bestExpectedDamage, effectiveLife, livingEnemies } from './ai-scoring';

/** COORDINACIÓN DE EQUIPO (2v2): el objetivo de foco se calcula como función
 *  PURA del estado, así todos los bots del mismo jugador llegan a la misma
 *  conclusión en la misma ronda sin memoria compartida. Concentrar el daño
 *  importa porque un bot a 1 de vida pega igual que uno entero: retirarlo del
 *  tablero antes reduce el daño total que recibe el equipo.
 *
 *  Criterios, en unidades comparables:
 *  - Rematable: cuanta menos vida efectiva le quede, antes cae (peso máximo).
 *  - Amenaza: quitarse de encima al enemigo que más daño esperado hace.
 *  - Alcanzable: un foco al otro lado del mapa no concentra nada — pondera la
 *    distancia media desde mis bots vivos.
 *  - Presión: prioriza al enemigo que amenaza a mi aliado más débil (peel). */
export function chooseFocusTarget(
  state: BattleState,
  player: PlayerId,
  fmap: Map<string, FunctionEntry>,
): BattleBot | null {
  const myBots = state.bots.filter(b => b.playerId === player && !b.destroyed && b.q !== -999);
  if (myBots.length === 0) return null;
  const enemies = livingEnemies(state, myBots[0]).filter(e => e.q !== -999);
  if (enemies.length === 0) return null;

  const weakestAlly = [...myBots].sort((a, b) => effectiveLife(a) - effectiveLife(b))[0];

  let best: BattleBot | null = null;
  let bestScore = -Infinity;
  for (const e of enemies) {
    const avgDist = myBots.reduce((s, b) => s + hexDistance(b.q, b.r, e.q, e.r), 0) / myBots.length;
    const threat = bestExpectedDamage(e, fmap);
    const menacesWeakest = hexDistance(e.q, e.r, weakestAlly.q, weakestAlly.r) <= e.maxMovement + 2;
    const score = -effectiveLife(e) * 1.0
      + threat * 0.8
      - avgDist * 0.5
      + (menacesWeakest ? 1.5 : 0);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/** Penalización por apelotonarse con aliados: los splashes enemigos (R(1)/R(2)
 *  de empField, chainLightning, gravityWell) castigan a los equipos juntos, y
 *  un aliado adyacente además bloquea movimiento y líneas de visión propias. */
export function allyClusterPenalty(
  state: BattleState,
  bot: BattleBot,
  q: number,
  r: number,
): number {
  let penalty = 0;
  for (const b of state.bots) {
    if (b.destroyed || b.id === bot.id || b.playerId !== bot.playerId || b.q === -999) continue;
    const d = hexDistance(q, r, b.q, b.r);
    if (d === 1) penalty += 1;
    else if (d === 2) penalty += 0.3;
  }
  return penalty;
}
