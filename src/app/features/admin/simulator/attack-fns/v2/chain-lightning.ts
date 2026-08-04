import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexDistance, lineOfSight } from '../../engine/pathfinding';

export const chainLightning: AttackFnDef = {
  id: 'chainLightning',
  rangeKind: 'splash',
  splashRadius: 2,
  rollDamage: ({ rollD }) => rollD(4),
  onHit: ({ attacker, target, bots, map, turn, activation, timestamp, damage, entities }): BattleEvent[] => {
    // Esta función siempre impacta sobre un Bot: solo gravityWell y
    // empField pueden apuntar a un Hex vacío.
    if (!target) return [];
    const events: BattleEvent[] = [];
    for (const bot of bots) {
      if (bot.id === target.id || bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(target.q, target.r, bot.q, bot.r) > 2) continue;
      // Barriers block chain (pass [] for bots so bots themselves don't block the arc)
      if (!lineOfSight(target.q, target.r, bot.q, bot.r, map, [], entities)) continue;
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
