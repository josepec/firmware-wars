import type { AttackFnDef } from '../attack-fn.types';
import type { BattleEvent } from '../../../../../shared/types/battle.types';

export const swapProtocol: AttackFnDef = {
  id: 'swapProtocol',
  rangeKind: 'normal',
  canTargetAllies: true,
  rollDamage: () => 0,
  onHit: ({ attacker, target, turn, activation, timestamp }): BattleEvent[] => {
    // Esta función siempre impacta sobre un Bot: solo gravityWell y
    // empField pueden apuntar a un Hex vacío.
    if (!target) return [];
    return [
    {
      turn, activation, phase: 'run', timestamp,
      botId: attacker.id,
      kind: 'moved',
      payload: { fromQ: attacker.q, fromR: attacker.r, toQ: target.q, toR: target.r, sourceFn: 'swapProtocol' },
    },
    {
      turn, activation, phase: 'run', timestamp,
      botId: target.id,
      kind: 'moved',
      payload: { fromQ: target.q, fromR: target.r, toQ: attacker.q, toR: attacker.r, sourceFn: 'swapProtocol' },
    },
  ];
  },
};
