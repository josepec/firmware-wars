import type { AttackFnDef } from '../attack-fn.types';

export const deployBarrier: AttackFnDef = {
  id: 'deployBarrier',
  rangeKind: 'self',
  rollDamage: () => 0,
};
