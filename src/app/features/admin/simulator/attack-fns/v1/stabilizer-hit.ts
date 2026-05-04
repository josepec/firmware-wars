import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const stabilizerHit: AttackFnDef = {
  id: 'stabilizerHit',
  rangeKind: 'normal',
  onHit: ({ target, turn, activation, timestamp, rollD }): BattleEvent[] => {
    if (rollD(6) >= 4) return [];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'status_applied',
      payload: { kind: 'LAG', sourceFn: 'stabilizerHit' },
    }];
  },
};
