import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexDistance } from '../../engine/pathfinding';

export const empField: AttackFnDef = {
  id: 'empField',
  rangeKind: 'splash',
  splashRadius: 1,
  canTargetEmptyHex: true,
  rollDamage: ({ rollD }) => rollD(6),
  onHit: ({ attacker, target, impactQ, impactR, bots, turn, activation, timestamp, rollD }): BattleEvent[] => {
    const events: BattleEvent[] = [];

    // Impactos en área R(1) desde el punto de impacto. Con Bot objetivo, el
    // motor ya le aplicó el daño primario y aquí se salta; apuntando a un Hex
    // vacío no hay primario y entran todos los que caigan dentro.
    for (const bot of bots) {
      if (target && bot.id === target.id) continue;
      if (bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(impactQ, impactR, bot.q, bot.r) > 1) continue;
      const dmg = rollD(6);
      const sc = Math.min(bot.shield, dmg);
      const dealt = dmg - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: bot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'empField' },
      });
      if (bot.life - dealt <= 0) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id, kind: 'destroyed',
          payload: { sourceFn: 'empField' },
        });
      }
    }

    // DMZ save: 1d6 ≥ 4 or receive DMZ — all bots hit (primary + secondary)
    for (const bot of bots) {
      if (bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(impactQ, impactR, bot.q, bot.r) > 1) continue;
      // SAFE_MODE inmuniza contra el DMZ: ni siquiera llega a tirar el dado
      if ((bot.statusEffects ?? []).some(s => s.kind === 'SAFE_MODE')) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id,
          kind: 'status_resisted',
          payload: { kind: 'DMZ', sourceFn: 'empField', blockedBy: 'SAFE_MODE' },
        });
        continue;
      }
      const roll = rollD(6);
      if (roll < 4) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id,
          kind: 'status_applied',
          payload: { kind: 'DMZ', roll, threshold: 4, sourceFn: 'empField' },
        });
      } else {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id,
          kind: 'status_resisted',
          payload: { kind: 'DMZ', roll, threshold: 4, sourceFn: 'empField' },
        });
      }
    }

    return events;
  },
};
