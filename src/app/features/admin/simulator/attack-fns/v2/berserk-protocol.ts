import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const berserkProtocol: AttackFnDef = {
  id: 'berserkProtocol',
  rangeKind: 'self',
  rollDamage: () => 0,
  onHit: ({ attacker, turn, activation, timestamp, rollD }): BattleEvent[] => {
    const selfDmg = rollD(4);
    const sc = Math.min(attacker.shield, selfDmg);
    const dealt = selfDmg - sc;
    const events: BattleEvent[] = [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'attack_hit',
      payload: { targetId: attacker.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'berserkProtocol', selfInflicted: true },
    }];
    if (attacker.life - dealt <= 0) {
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'destroyed',
        payload: { sourceFn: 'berserkProtocol' },
      });
    } else {
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'status_applied',
        payload: { kind: 'BERSERK', sourceFn: 'berserkProtocol' },
      });
    }
    return events;
  },
};
