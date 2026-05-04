import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent, MapEntity } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, isTraversable } from '../../engine/pathfinding';

export const relayNode: AttackFnDef = {
  id: 'relayNode',
  rangeKind: 'self',
  rollDamage: () => 0,
  onHit: ({ attacker, bots, map, entities, turn, activation, timestamp }): BattleEvent[] => {
    const myNodes = (entities ?? []).filter(e => e.kind === 'relay_node' && e.ownerId === attacker.id);
    if (myNodes.length >= 2) return [];
    const idx = buildHexIndex(map);
    const occupied = new Set([
      ...bots.filter(b => !b.destroyed).map(b => hexKey(b.q, b.r)),
      ...(entities ?? []).map(e => hexKey(e.q, e.r)),
    ]);
    const enemies = bots.filter(b => b.playerId !== attacker.playerId && !b.destroyed);
    let bestHex: { q: number; r: number } | null = null;
    let bestDist = Infinity;
    for (const cell of map.hexes) {
      if (hexDistance(attacker.q, attacker.r, cell.q, cell.r) !== 1) continue;
      if (!isTraversable(idx.get(hexKey(cell.q, cell.r)), map)) continue;
      if (occupied.has(hexKey(cell.q, cell.r))) continue;
      const d = enemies.length > 0
        ? hexDistance(cell.q, cell.r, enemies[0].q, enemies[0].r)
        : 0;
      if (d < bestDist) { bestDist = d; bestHex = cell; }
    }
    if (!bestHex) return [];
    const entity: MapEntity = {
      id: `relay_${attacker.id}_${turn}_${activation}`,
      kind: 'relay_node',
      q: bestHex.q, r: bestHex.r,
      life: 2,
      ownerId: attacker.id,
    };
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'entity_placed',
      payload: { entity },
    }];
  },
};
