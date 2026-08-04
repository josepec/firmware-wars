import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import { buildHexIndex, hexDistance, hexPushDir, isTraversable } from '../../engine/pathfinding';

export const gravityWell: AttackFnDef = {
  id: 'gravityWell',
  rangeKind: 'splash',
  splashRadius: 2,
  canTargetEmptyHex: true,
  rollDamage: ({ rollD }) => rollD(6),
  onHit: ({ attacker, target, impactQ, impactR, bots, map, turn, activation, timestamp, damage, entities }): BattleEvent[] => {
    const events: BattleEvent[] = [];
    const idx = buildHexIndex(map);

    /* Hexes ocupados, actualizados a medida que se resuelven las atracciones.
       Hace falta llevar la cuenta: apuntando a un Hex vacío, dos Bots en lados
       opuestos son atraídos al MISMO centro libre, y comparando solo contra las
       posiciones de partida acabarían los dos en la misma casilla. */
    const ocupados = new Set<string>();
    for (const b of bots) if (!b.destroyed) ocupados.add(hexKey(b.q, b.r));
    for (const e of entities ?? []) ocupados.add(hexKey(e.q, e.r));

    for (const bot of bots) {
      // Con Bot objetivo, el motor ya le aplicó el daño primario y aquí se
      // salta. Apuntando a un Hex vacío no hay primario: entran todos.
      if (target && bot.id === target.id) continue;
      if (bot.id === attacker.id || bot.destroyed) continue;
      if (hexDistance(impactQ, impactR, bot.q, bot.r) > 2) continue;
      const sc = Math.min(bot.shield, damage);
      const dealt = damage - sc;
      events.push({
        turn, activation, phase: 'run', timestamp,
        botId: attacker.id,
        kind: 'attack_hit',
        payload: { targetId: bot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'gravityWell' },
      });
      const destruido = bot.life - dealt <= 0;
      if (destruido) {
        events.push({
          turn, activation, phase: 'run', timestamp,
          botId: bot.id, kind: 'destroyed',
          payload: { sourceFn: 'gravityWell' },
        });
      }
      // Atrae 1 Hex hacia el centro del impacto. El destino ha de estar
      // libre: ni obstáculo, ni otro Bot, ni entidad. Si no, no se mueve.
      const [dq, dr] = hexPushDir(bot.q, bot.r, impactQ, impactR);
      const pullQ = bot.q + dq;
      const pullR = bot.r + dr;
      const destino = hexKey(pullQ, pullR);
      if (
        !destruido &&
        isTraversable(idx.get(destino), map) &&
        !ocupados.has(destino)
      ) {
        ocupados.delete(hexKey(bot.q, bot.r));
        ocupados.add(destino);
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
