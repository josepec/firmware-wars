import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexDistance } from '../../engine/pathfinding';

export const flashSpin: AttackFnDef = {
  id: 'flashSpin',
  rangeKind: 'self',
  rollDamage: () => 0,
  onHit: ({ attacker, bots, turn, activation, timestamp, rollD }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    for (const bot of bots) {
      if (bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(attacker.q, attacker.r, bot.q, bot.r) !== 1) continue;
      const dmg = rollD(8);
      const sc = Math.min(bot.shield, dmg);
      const dealt = dmg - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: bot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'flashSpin' },
      });
      if (bot.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id, kind: 'destroyed',
          payload: { sourceFn: 'flashSpin' },
        });
      }
    }
    return events;
  },
};
