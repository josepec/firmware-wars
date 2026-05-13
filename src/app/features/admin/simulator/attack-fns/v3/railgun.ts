import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexPushDir, isTraversable } from '../../engine/pathfinding';

export const railgun: AttackFnDef = {
  id: 'railgun',
  rangeKind: 'LR',
  rollDamage: ({ rollD }) => rollD(8),
  onHit: ({ attacker, target, bots, map, damage, turn, activation, timestamp, entities }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    const idx = buildHexIndex(map);
    const [dq, dr] = hexPushDir(attacker.q, attacker.r, target.q, target.r);
    let curQ = target.q, curR = target.r;
    let reduction = 2;
    while (true) {
      curQ += dq; curR += dr;
      const cell = idx.get(hexKey(curQ, curR));
      if (!cell || !isTraversable(cell, map)) break;
      if ((entities ?? []).some(e => e.q === curQ && e.r === curR)) break;
      const hitBot = bots.find(b => !b.destroyed && b.id !== target.id && b.q === curQ && b.r === curR);
      if (!hitBot) continue;
      const pierceDmg = Math.max(0, damage - reduction);
      reduction += 2;
      if (pierceDmg === 0) continue;
      const sc = Math.min(hitBot.shield, pierceDmg);
      const dealt = pierceDmg - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: hitBot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'railgun' },
      });
      if (hitBot.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: hitBot.id, kind: 'destroyed',
          payload: { sourceFn: 'railgun' },
        });
      }
    }
    return events;
  },
};
