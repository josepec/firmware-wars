import type { BattleBot, CpuLevel } from '../../../../../shared/types/battle.types';
import type { RandomFn } from '../ai.types';

export interface DebugAction {
  action: 'debug' | 'patch' | 'optimize' | 'reboot';
  n?: number;
}

/** Acciones de la fase DEBUG del bot (antes de finalizar el turno).
 *  debug: 2⚡ → −1 bug · patch: 5⚡ → −todos · optimize(n): n⚡ → −n números · reboot: pierde turno.
 *  N1: no hace nada.
 *  N2: patch si compensa (bugs≥3), debug sueltos con energía sobrante (reserva 2⚡).
 *  N3: igual con reserva, y reboot si el bot quedó inutilizado por bugs sin energía. */
export function chooseDebugActions(
  bot: BattleBot,
  level: CpuLevel,
  rand: RandomFn,
): DebugAction[] {
  void rand;
  if (level === 1) return [];

  const reserve = 2;
  const actions: DebugAction[] = [];
  let energy = bot.energy;
  let bugs = bot.bugs;

  if (level === 3 && bugs >= bot.maxOperations - 1 && energy < 5) {
    // Bot casi sin slots y sin energía para limpiarlos: reinicio total
    return [{ action: 'reboot' }];
  }

  if (bugs >= 3 && energy >= 5 + reserve) {
    actions.push({ action: 'patch' });
    energy -= 5;
    bugs = 0;
  }
  while (bugs > 0 && energy >= 2 + reserve) {
    actions.push({ action: 'debug' });
    energy -= 2;
    bugs--;
  }
  return actions;
}
