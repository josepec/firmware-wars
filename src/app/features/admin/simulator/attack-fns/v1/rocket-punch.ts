import type { AttackFnDef } from '../attack-fn.types';

export const rocketPunch: AttackFnDef = {
  id: 'rocketPunch',
  rangeKind: 'normal',
  rollDamage: ({ rollD }) => rollD(4),
};
