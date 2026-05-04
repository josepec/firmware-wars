import type { AttackFnDef } from '../attack-fn.types';

export const syncBlast: AttackFnDef = {
  id: 'syncBlast',
  rangeKind: 'normal',
  rollDamage: ({ attacker }) => 4 + (attacker.energy > 10 ? 1 : 0),
};
