import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const chargedStrike: AttackFnDef = {
  id: 'chargedStrike',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => {
    // Accumulate d4 rolls until a 1 appears; target takes the total, attacker also takes it (backfire)
    let total = 0, roll: number;
    do { roll = rollD(4); total += roll; } while (roll > 1);
    return total;
  },
  onHit: ({ attacker, damage, turn, activation, timestamp }): BattleEvent[] => {
    // Backfire: attacker always takes the same raw damage (loop always ends on a 1)
    const events: BattleEvent[] = [{
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'attack_hit',
      payload: { targetId: attacker.id, damage, shieldConsumed: 0, energyCost: 0, sourceFn: 'chargedStrike', selfInflicted: true },
    }];
    if (attacker.life - damage <= 0) {
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id, kind: 'destroyed',
        payload: { sourceFn: 'chargedStrike' },
      });
    }
    return events;
  },
};
