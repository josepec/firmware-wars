import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const overclockStrike: AttackFnDef = {
  id: 'overclockStrike',
  rangeKind: 'self',
  rollDamage: () => 0,
  onHit: ({ attacker, turn, activation, timestamp }): BattleEvent[] => [{
    turn, activation, phase: 'run', timestamp,
    botId: attacker.id,
    kind: 'status_applied',
    payload: { kind: 'OVERCLOCK', sourceFn: 'overclockStrike' },
  }],
};
