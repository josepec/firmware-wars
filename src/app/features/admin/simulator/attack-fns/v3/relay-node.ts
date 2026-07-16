import type { AttackFnDef } from '../attack-fn.types';

/** El despliegue lo resuelve el simulador (step `relay-node`): el jugador elige
 *  el hex a rango ≤ 2. Ver `simulator-relay-node.utils.ts`. */
export const relayNode: AttackFnDef = {
  id: 'relayNode',
  rangeKind: 'self',
  rollDamage: () => 0,
};
