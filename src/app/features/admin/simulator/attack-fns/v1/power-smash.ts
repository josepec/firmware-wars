import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexPushDir, isTraversable } from '../../engine/pathfinding';

export const powerSmash: AttackFnDef = {
  id: 'powerSmash',
  rangeKind: 'normal',
  onHit: ({ attacker, target, bots, map, turn, activation, timestamp }): BattleEvent[] => {
    // Esta función siempre impacta sobre un Bot: solo gravityWell y
    // empField pueden apuntar a un Hex vacío.
    if (!target) return [];
    const [dq, dr] = hexPushDir(attacker.q, attacker.r, target.q, target.r);
    const pushQ = target.q + dq;
    const pushR = target.r + dr;
    const idx = buildHexIndex(map);
    if (!isTraversable(idx.get(hexKey(pushQ, pushR)), map)) return [];
    if (bots.some(b => !b.destroyed && b.q === pushQ && b.r === pushR)) return [];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'moved',
      payload: { fromQ: target.q, fromR: target.r, toQ: pushQ, toR: pushR, sourceFn: 'powerSmash' },
    }];
  },
};
