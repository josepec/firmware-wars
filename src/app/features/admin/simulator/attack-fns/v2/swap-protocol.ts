import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const swapProtocol: AttackFnDef = {
  id: 'swapProtocol',
  rangeKind: 'normal',
  rollDamage: () => 0,
  onHit: ({ attacker, target, turn, activation, timestamp }): BattleEvent[] => [
    {
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'moved',
      payload: { fromQ: attacker.q, fromR: attacker.r, toQ: target.q, toR: target.r, sourceFn: 'swapProtocol' },
    },
    {
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'moved',
      payload: { fromQ: target.q, fromR: target.r, toQ: attacker.q, toR: attacker.r, sourceFn: 'swapProtocol' },
    },
  ],
};
