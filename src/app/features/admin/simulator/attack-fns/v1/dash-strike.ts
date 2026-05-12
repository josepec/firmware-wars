import type { AttackFnDef } from '../attack-fn.types';

export const dashStrike: AttackFnDef = {
  id: 'dashStrike',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(4),
  freeMove: true,
};
