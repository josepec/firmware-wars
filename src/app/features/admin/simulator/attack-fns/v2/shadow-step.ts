import type { AttackFnDef } from '../attack-fn.types';

export const shadowStep: AttackFnDef = {
  id: 'shadowStep',
  rangeKind: 'self',
  rollDamage: () => 0,
  // Move is handled interactively by the simulator (player picks destination hex).
};
