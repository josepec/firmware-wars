import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const stabilizerHit: AttackFnDef = {
  id: 'stabilizerHit',
  rangeKind: 'normal',
  onHit: ({ target, turn, activation, timestamp, rollD }): BattleEvent[] => {
    // Esta función siempre impacta sobre un Bot: solo gravityWell y
    // empField pueden apuntar a un Hex vacío.
    if (!target) return [];
    const roll = rollD(6);
    if (roll >= 4) return [{
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'status_resisted',
      payload: { kind: 'LAG', roll, threshold: 4, sourceFn: 'stabilizerHit' },
    }];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'status_applied',
      payload: { kind: 'LAG', roll, threshold: 4, sourceFn: 'stabilizerHit' },
    }];
  },
};
