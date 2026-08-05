import type { BattleBot, CpuLevel } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { parseEnergy } from '../../simulator-run.utils';
import { pickRandom, type RandomFn } from '../ai.types';
import { attackEntries, expectedUsefulEnergy, overflowProbability } from './ai-scoring';

/** Coste aproximado de un bug en "energía equivalente": ocupa un slot de
 *  operación el próximo turno y cuesta 2⚡ limpiarlo. */
const BUG_COST = 4;

/** Riesgo de overflow que N2 acepta. La regla de la esperanza sola
 *  (energy + 3.5·k ≤ maxEnergy) no mira la cola de la distribución, y ahí es
 *  donde estaba el problema: con 6⚡ de 18 daba luz verde a 3 dados, que son
 *  P(3d6 > 12) ≈ 26% de bug a cambio de energía que el bot ni necesitaba.
 *  Un tope explícito corta esas apuestas sin tocar las buenas (3 dados con el
 *  depósito vacío siguen siendo ~9% de riesgo, y se toman). */
const N2_MAX_OVERFLOW_RISK = 0.2;

/** Cuánto vale la energía que pasa del techo de gasto del turno. No es cero —
 *  se queda en el depósito y sirve en turnos siguientes — pero tampoco vale
 *  como la que se va a usar ya: depende de que el próximo turno salga un
 *  programa que la aproveche y de no toparse con maxEnergy por el camino. */
const BANKED_ENERGY_VALUE = 0.35;

/** Energía que el bot puede llegar a GASTAR en un turno: una función por slot,
 *  al precio de la más cara que tenga, más los 2⚡ de la acción de DEBUG.
 *
 *  Sirve para no premiar energía que no cabe en el turno. `expectedUsefulEnergy`
 *  solo descuenta lo que se pierde por encima de `maxEnergy`, así que un bot con
 *  14⚡ de 18 que quema 9 por turno "ganaba" 3⚡ de valor pleno tirando un dado —
 *  y con ello se jugaba un 33% de bug por energía que no iba a usar. */
function spendCeiling(bot: BattleBot, fmap: Map<string, FunctionEntry>): number {
  const slots = Math.max(1, bot.maxOperations - bot.bugs);
  let unit = Math.max(2, bot.maxMovement);
  for (const { entry } of attackEntries(bot, fmap)) {
    unit = Math.max(unit, parseEnergy(entry.energy));
  }
  return slots * unit + 2;
}

/** Cuántos dados d6 de energía tirar en BOOT (0–3). Más dados = más energía,
 *  pero si el total supera maxEnergy hay overflow → +1 bug.
 *  N1: aleatorio 0–3.
 *  N2: el mayor k que cumple LAS DOS cosas — sin riesgo en esperanza
 *      (energy + 3.5·k ≤ maxEnergy) y P(overflow) bajo el tope; al menos 1
 *      si va corto de energía y ese dado no puede desbordar.
 *  N3: argmax de valor(energía ganada) − P(overflow)·costeBug, con convolución
 *      exacta y la energía por encima del techo de gasto valorada a la baja. */
export function chooseBootDice(
  bot: BattleBot,
  level: CpuLevel,
  rand: RandomFn,
  fmap: Map<string, FunctionEntry>,
): 0 | 1 | 2 | 3 {
  if (level === 1) return pickRandom([0, 1, 2, 3] as const, rand);

  if (level === 2) {
    const safe = (cand: 1 | 2 | 3) =>
      bot.energy + 3.5 * cand <= bot.maxEnergy
      && overflowProbability(bot.energy, bot.maxEnergy, cand) <= N2_MAX_OVERFLOW_RISK;
    let k: 0 | 1 | 2 | 3 = 0;
    for (const cand of [1, 2, 3] as const) {
      if (safe(cand)) k = cand;
    }
    if (k === 0 && bot.energy < bot.maxEnergy * 0.5
      && overflowProbability(bot.energy, bot.maxEnergy, 1) <= N2_MAX_OVERFLOW_RISK) {
      k = 1;
    }
    return k;
  }

  // N3
  const headroom = Math.max(0, Math.min(bot.maxEnergy, spendCeiling(bot, fmap)) - bot.energy);
  let best: 0 | 1 | 2 | 3 = 0;
  let bestUtility = 0;
  for (const k of [1, 2, 3] as const) {
    // El overflow se mide contra maxEnergy, que es la regla del juego. El VALOR
    // de lo ganado se mide contra el techo de gasto, que es lo que de verdad
    // puede aprovechar este turno.
    const gain = expectedUsefulEnergy(bot.energy, bot.maxEnergy, k);
    const value = Math.min(gain, headroom)
      + BANKED_ENERGY_VALUE * Math.max(0, gain - headroom);
    const utility = value - overflowProbability(bot.energy, bot.maxEnergy, k) * BUG_COST;
    if (utility > bestUtility) { bestUtility = utility; best = k; }
  }
  return best;
}
