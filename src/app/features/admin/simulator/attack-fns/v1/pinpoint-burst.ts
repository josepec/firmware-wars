import type { AttackFnDef } from '../attack-fn.types';

export const pinpointBurst: AttackFnDef = {
  id: 'pinpointBurst',
  rangeKind: 'LR',
  rollDamage: ({ rollD }) => rollD(4),
};
