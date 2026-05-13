import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, hexPushDir, isTraversable } from '../../engine/pathfinding';

export const gravityWell: AttackFnDef = {
  id: 'gravityWell',
  rangeKind: 'splash',
  splashRadius: 2,
  rollDamage: ({ rollD }) => rollD(6),
  onHit: ({ attacker, target, bots, map, turn, activation, timestamp, damage }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    const idx = buildHexIndex(map);
    for (const bot of bots) {
      if (bot.id === target.id || bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(target.q, target.r, bot.q, bot.r) > 2) continue;
      const sc = Math.min(bot.shield, damage);
      const dealt = damage - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: bot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'gravityWell' },
      });
      if (bot.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id, kind: 'destroyed',
          payload: { sourceFn: 'gravityWell' },
        });
      }
      // Pull 1 hex toward impact center
      const [dq, dr] = hexPushDir(bot.q, bot.r, target.q, target.r);
      const pullQ = bot.q + dq;
      const pullR = bot.r + dr;
      if (
        isTraversable(idx.get(hexKey(pullQ, pullR)), map) &&
        !bots.some(b => !b.destroyed && b.id !== bot.id && b.q === pullQ && b.r === pullR)
      ) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id,
          kind: 'moved',
          payload: { fromQ: bot.q, fromR: bot.r, toQ: pullQ, toR: pullR, sourceFn: 'gravityWell' },
        });
      }
    }
    return events;
  },
};
