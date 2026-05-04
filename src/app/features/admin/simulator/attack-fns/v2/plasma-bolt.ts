import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const plasmaBolt: AttackFnDef = {
  id: 'plasmaBolt',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(6),
  onHit: ({ attacker, damage, turn, activation, timestamp }): BattleEvent[] => {
    if (damage < 6) return [];
    return [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'attack_hit',
      payload: { damage: 0, energyCost: 2, sourceFn: 'plasmaBolt', overheat: true },
    }];
  },
};
