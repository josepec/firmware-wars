import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const ghostProtocol: AttackFnDef = {
  id: 'ghostProtocol',
  rangeKind: 'normal',
  rollDamage: () => 0,
  onHit: ({ target, turn, activation, timestamp }): BattleEvent[] => {
    if (target.numbers.length === 0) return [];
    const idx = Math.floor(Math.random() * target.numbers.length);
    const removedValue = target.numbers[idx];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'numbers_lost',
      payload: { count: 1, removedValue, sourceFn: 'ghostProtocol' },
    }];
  },
};
