import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexDistance } from '../../engine/pathfinding';

export const flashSpin: AttackFnDef = {
  id: 'flashSpin',
  rangeKind: 'self',
  rollDamage: ({ rollD }) => rollD(8),
  onHit: ({ attacker, bots, entities, turn, activation, timestamp, damage }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    for (const bot of bots) {
      if (bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(attacker.q, attacker.r, bot.q, bot.r) !== 1) continue;
      const sc = Math.min(bot.shield, damage);
      const dealt = damage - sc;
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
    for (const entity of (entities ?? [])) {
      if (hexDistance(attacker.q, attacker.r, entity.q, entity.r) !== 1) continue;
      const dealt = Math.min(damage, entity.life);
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'entity_damaged',
        payload: { entityId: entity.id, damage: dealt, sourceFn: 'flashSpin' },
      });
      if (entity.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: attacker.id, kind: 'entity_destroyed',
          payload: { entityId: entity.id, sourceFn: 'flashSpin' },
        });
      }
    }
    return events;
  },
};
