import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, hexPushDir, isTraversable } from '../../engine/pathfinding';

export const dashStrike: AttackFnDef = {
  id: 'dashStrike',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(4),
  onHit: ({ attacker, bots, map, turn, activation, timestamp }): BattleEvent[] => {
    const enemies = bots.filter(b => b.playerId !== attacker.playerId && !b.destroyed);
    if (enemies.length === 0) return [];
    const nearest = enemies.reduce((a, b) =>
      hexDistance(attacker.q, attacker.r, a.q, a.r) <= hexDistance(attacker.q, attacker.r, b.q, b.r) ? a : b);
    const [dq, dr] = hexPushDir(attacker.q, attacker.r, nearest.q, nearest.r);
    const moveQ = attacker.q + dq;
    const moveR = attacker.r + dr;
    const idx = buildHexIndex(map);
    if (!isTraversable(idx.get(hexKey(moveQ, moveR)), map)) return [];
    if (bots.some(b => !b.destroyed && b.id !== attacker.id && b.q === moveQ && b.r === moveR)) return [];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'moved',
      payload: { fromQ: attacker.q, fromR: attacker.r, toQ: moveQ, toR: moveR, sourceFn: 'dashStrike' },
    }];
  },
};
