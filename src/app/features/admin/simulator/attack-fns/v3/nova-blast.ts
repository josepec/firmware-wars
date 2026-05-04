import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const novaBlast: AttackFnDef = {
  id: 'novaBlast',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(10),
  onHit: ({ attacker, turn, activation, timestamp }): BattleEvent[] => [{
    turn, activation, phase: 'run', timestamp,
    botId: attacker.id,
    kind: 'bug_added',
    payload: { count: 1, sourceFn: 'novaBlast', recoil: true },
  }],
};
