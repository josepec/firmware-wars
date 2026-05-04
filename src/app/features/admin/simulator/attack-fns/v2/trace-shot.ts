import type { AttackFnDef } from '../attack-fn.types';

export const traceShot: AttackFnDef = {
  id: 'traceShot',
  rangeKind: 'SLDV',
  rollDamage: ({ rollD }) => rollD(4),
};
