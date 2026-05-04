import type { AttackFnDef } from '../attack-fn.types';

export const overdriveStrike: AttackFnDef = {
  id: 'overdriveStrike',
  rangeKind: 'normal',
  computeEnergyCost: (bot) => Math.max(2, bot.energy),
  rollDamage: ({ energyCost }) => Math.floor(energyCost / 2),
};
