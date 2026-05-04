import type { AttackFnDef } from '../attack-fn.types';

export const peekMemory: AttackFnDef = {
  id: 'peekMemory',
  rangeKind: 'normal',
  rollDamage: () => 0,
  // En el simulador AI toda la información es compartida, no hay estado privado que revelar.
  // En una partida real este efecto requeriría un canal de información por jugador.
};
