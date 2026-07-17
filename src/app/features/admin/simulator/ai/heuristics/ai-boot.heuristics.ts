import type { BattleBot, CpuLevel } from '../../../../../shared/types/battle.types';
import { pickRandom, type RandomFn } from '../ai.types';
import { expectedUsefulEnergy, overflowProbability } from './ai-scoring';

/** Coste aproximado de un bug en "energía equivalente": ocupa un slot de
 *  operación el próximo turno y cuesta 2⚡ limpiarlo. */
const BUG_COST = 4;

/** Cuántos dados d6 de energía tirar en BOOT (0–3). Más dados = más energía,
 *  pero si el total supera maxEnergy hay overflow → +1 bug.
 *  N1: aleatorio 0–3.
 *  N2: el mayor k sin riesgo en esperanza (energy + 3.5·k ≤ maxEnergy); al menos 1
 *      si va corto de energía.
 *  N3: argmax de E[energía útil] − P(overflow)·costeBug (convolución exacta). */
export function chooseBootDice(
  bot: BattleBot,
  level: CpuLevel,
  rand: RandomFn,
): 0 | 1 | 2 | 3 {
  if (level === 1) return pickRandom([0, 1, 2, 3] as const, rand);

  if (level === 2) {
    let k: 0 | 1 | 2 | 3 = 0;
    for (const cand of [1, 2, 3] as const) {
      if (bot.energy + 3.5 * cand <= bot.maxEnergy) k = cand;
    }
    if (k === 0 && bot.energy < bot.maxEnergy * 0.5) k = 1;
    return k;
  }

  // N3
  let best: 0 | 1 | 2 | 3 = 0;
  let bestUtility = 0;
  for (const k of [1, 2, 3] as const) {
    const utility = expectedUsefulEnergy(bot.energy, bot.maxEnergy, k)
      - overflowProbability(bot.energy, bot.maxEnergy, k) * BUG_COST;
    if (utility > bestUtility) { bestUtility = utility; best = k; }
  }
  return best;
}
