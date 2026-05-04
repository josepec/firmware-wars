import type { AttackFnDef } from '../attack-fn.types';

export const ionCannon: AttackFnDef = {
  id: 'ionCannon',
  rangeKind: 'LR',
  rollDamage: ({ rollD }) => rollD(6),
};
