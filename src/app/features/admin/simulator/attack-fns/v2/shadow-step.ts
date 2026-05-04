import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, isTraversable } from '../../engine/pathfinding';

export const shadowStep: AttackFnDef = {
  id: 'shadowStep',
  rangeKind: 'self',
  rollDamage: () => 0,
  onHit: ({ attacker, bots, map, turn, activation, timestamp }): BattleEvent[] => {
    const enemies = bots.filter(b => b.playerId !== attacker.playerId && !b.destroyed);
    if (enemies.length === 0) return [];
    const nearest = enemies.reduce((a, b) =>
      hexDistance(attacker.q, attacker.r, a.q, a.r) <= hexDistance(attacker.q, attacker.r, b.q, b.r) ? a : b);
    const idx = buildHexIndex(map);
    const occupied = new Set(bots.filter(b => !b.destroyed && b.id !== attacker.id).map(b => hexKey(b.q, b.r)));
    let bestHex: { q: number; r: number } | null = null;
    let bestDist = hexDistance(attacker.q, attacker.r, nearest.q, nearest.r);
    for (const cell of map.hexes) {
      const dist = hexDistance(attacker.q, attacker.r, cell.q, cell.r);
      if (dist === 0 || dist > 3) continue;
      if (!isTraversable(idx.get(hexKey(cell.q, cell.r)), map)) continue;
      if (occupied.has(hexKey(cell.q, cell.r))) continue;
      const dToEnemy = hexDistance(cell.q, cell.r, nearest.q, nearest.r);
      if (dToEnemy < bestDist) { bestDist = dToEnemy; bestHex = cell; }
    }
    if (!bestHex) return [];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'moved',
      payload: { fromQ: attacker.q, fromR: attacker.r, toQ: bestHex.q, toR: bestHex.r, sourceFn: 'shadowStep' },
    }];
  },
};
