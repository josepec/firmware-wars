import {
  hexKey,
  type BattleBot,
  type BattleEvent,
  type BattleState,
  type MapEntity,
} from '../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, isTraversable } from './engine/pathfinding';

/** Reglas del Nodo Relay (`relayNode()`, V3):
 *  - Se despliega en un hex libre a rango ≤ 2 del Bot.
 *  - `life` = 2 y puede recibir daño como cualquier entidad.
 *  - Máximo 2 Nodos simultáneos por Bot.
 *  - Daño 2 a cualquier Bot (aliados incluidos) que entre o salga de un hex adyacente.
 *  - Un Nodo destruido deja de producir daño.
 */
export const RELAY_NODE_MAX = 2;
export const RELAY_NODE_LIFE = 2;
export const RELAY_NODE_RANGE = 2;
export const RELAY_NODE_DAMAGE = 2;

export function relayNodesOf(entities: MapEntity[] | undefined, botId: string): MapEntity[] {
  return (entities ?? []).filter(e => e.kind === 'relay_node' && e.ownerId === botId);
}

/** Hexes donde `bot` puede desplegar un Nodo: distancia 1..2, transitables y libres.
 *  Ocupan hex tanto los Bots destruidos (sus restos siguen en el tablero) como las
 *  entidades ya desplegadas (Barreras y otros Nodos). */
export function relayNodeValidHexes(state: BattleState, bot: BattleBot): Set<string> {
  const idx = buildHexIndex(state.hexMap);
  const occupied = new Set([
    ...state.bots.map(b => hexKey(b.q, b.r)),
    ...(state.entities ?? []).map(e => hexKey(e.q, e.r)),
  ]);
  const result = new Set<string>();
  for (const cell of state.hexMap.hexes) {
    const d = hexDistance(bot.q, bot.r, cell.q, cell.r);
    if (d < 1 || d > RELAY_NODE_RANGE) continue;
    const k = hexKey(cell.q, cell.r);
    if (!isTraversable(idx.get(k), state.hexMap)) continue;
    if (occupied.has(k)) continue;
    result.add(k);
  }
  return result;
}

/** Nodos vivos cuya corona (hexes adyacentes) cruza el Bot al moverse `from` → `to`.
 *  Sólo cuenta cruzar el borde: moverse de un hex de la corona a otro no dispara nada. */
export function relayNodesCrossedBy(
  entities: MapEntity[] | undefined,
  from: { q: number; r: number },
  to: { q: number; r: number },
): MapEntity[] {
  return (entities ?? []).filter(node => {
    if (node.kind !== 'relay_node' || node.life <= 0) return false;
    const wasAdjacent = hexDistance(from.q, from.r, node.q, node.r) === 1;
    const isAdjacent = hexDistance(to.q, to.r, node.q, node.r) === 1;
    return wasAdjacent !== isAdjacent;
  });
}

/** Eventos de daño que provocan los Nodos al mover `botId` de `from` a `to`.
 *  Encadena escudo y vida entre nodos para que varios Nodos resuelvan en orden. */
export function relayNodeDamageEvents(
  state: BattleState,
  botId: string,
  from: { q: number; r: number },
  to: { q: number; r: number },
  timestamp: string,
): BattleEvent[] {
  const target = state.bots.find(b => b.id === botId);
  if (!target || target.destroyed) return [];
  const nodes = relayNodesCrossedBy(state.entities, from, to);
  if (nodes.length === 0) return [];

  const events: BattleEvent[] = [];
  let shield = target.shield;
  let life = target.life;
  for (const node of nodes) {
    const shieldConsumed = Math.min(shield, RELAY_NODE_DAMAGE);
    const damage = RELAY_NODE_DAMAGE - shieldConsumed;
    shield -= shieldConsumed;
    life = Math.max(0, life - damage);
    events.push({
      turn: state.turn, activation: state.currentActivationIdx, phase: 'run',
      timestamp, botId: node.ownerId,
      kind: 'attack_hit',
      payload: {
        targetId: botId, damage, shieldConsumed, energyCost: 0,
        sourceFn: 'relayNode', entityId: node.id,
      },
    });
    if (life <= 0) {
      events.push({
        turn: state.turn, activation: state.currentActivationIdx, phase: 'run',
        timestamp, botId, kind: 'destroyed', payload: { sourceFn: 'relayNode' },
      });
      break;
    }
  }
  return events;
}
