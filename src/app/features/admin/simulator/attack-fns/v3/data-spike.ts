import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const dataSpike: AttackFnDef = {
  id: 'dataSpike',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(8),
  onHit: ({ target, turn, activation, timestamp }): BattleEvent[] => [{
    turn, activation, phase: 'run', timestamp,
    botId: target.id,
    kind: 'bug_added',
    payload: { count: 1, sourceFn: 'dataSpike' },
  }],
};
