import type { AttackFnDef } from '../attack-fn.types';

export const chargedStrike: AttackFnDef = {
  id: 'chargedStrike',
  rangeKind: 'normal',
  // Push-your-luck mechanic handled interactively in simulator-play.ts (charged-rolling step)
};
