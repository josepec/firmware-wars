import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const nanoRepair: AttackFnDef = {
  id: 'nanoRepair',
  rangeKind: 'self',
  noEntityTarget: true,
  rollDamage: () => 0,
  onHit: ({ attacker, turn, activation, timestamp, rollD }): BattleEvent[] => {
    const amount = rollD(4);
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'healed',
      payload: { amount, sourceFn: 'nanoRepair' },
    }];
  },
};
