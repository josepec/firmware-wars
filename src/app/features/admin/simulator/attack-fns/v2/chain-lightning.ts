import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexDistance } from '../../engine/pathfinding';

export const chainLightning: AttackFnDef = {
  id: 'chainLightning',
  rangeKind: 'splash',
  splashRadius: 2,
  rollDamage: ({ rollD }) => rollD(4),
  onHit: ({ attacker, target, bots, turn, activation, timestamp, damage }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    for (const bot of bots) {
      if (bot.id === target.id || bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(target.q, target.r, bot.q, bot.r) > 2) continue;
      const sc = Math.min(bot.shield, damage);
      const dealt = damage - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: bot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'chainLightning' },
      });
      if (bot.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id,
          kind: 'destroyed',
          payload: { sourceFn: 'chainLightning' },
        });
      }
    }
    return events;
  },
};
