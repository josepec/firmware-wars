import type { AttackFnDef } from '../attack-fn.types';
import { hexDistance } from '../../engine/pathfinding';

export const pulseShot: AttackFnDef = {
  id: 'pulseShot',
  rangeKind: 'normal',
  rollDamage: ({ attacker, target }) =>
    2 + (hexDistance(attacker.q, attacker.r, target.q, target.r) === 1 ? 1 : 0),
};
