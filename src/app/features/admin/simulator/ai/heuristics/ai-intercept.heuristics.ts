import type {
  BattleBot,
  BattleState,
  CompiledOperation,
  CpuLevel,
} from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import type { OperationFace } from '../../engine/dice';
import { evaluate } from '../../engine/dice';
import { computeAttackTargets } from '../../simulator-run.utils';
import { pickRandom, type RandomFn } from '../ai.types';
import { numberFlexValue } from './ai-scoring';

export interface InterceptCtx {
  state: BattleState;
  interceptor: BattleBot;
  /** Bot activo cuya operación se puede interceptar. */
  activeBot: BattleBot;
  /** Operación en curso y comparador ya tirado. */
  op: CompiledOperation | null;
  opFace: OperationFace | null;
  level: CpuLevel;
  rand: RandomFn;
  fmap: Map<string, FunctionEntry>;
}

/** JUEGO LIMPIO: los numbers del rival son información oculta (peekMemory existe
 *  para revelarlos), así que la IA NO los lee. Razona como un jugador real:
 *  el comparador es público, el dominio de numbers es 1..6, y el nº de fichas
 *  que sostiene el rival se ve en la mesa (la cantidad, no los valores). */

/** ¿Cuántos valores n ∈ 1..6 satisfarían la condición si sustituimos el d6 por v? */
export function satisfyingCount(v: number, opFace: OperationFace): number {
  let s = 0;
  for (let n = 1; n <= 6; n++) {
    if (evaluate(v, n, opFace)) s++;
  }
  return s;
}

/** Valores propios que bloquean la rama TRUE del rival PASE LO QUE PASE:
 *  sustituido el d6 por v, ningún number posible (1..6) satisface la condición. */
export function guaranteedBlockingValues(ctx: InterceptCtx): number[] {
  if (!ctx.opFace) return [];
  return ctx.interceptor.numbers.filter(v => satisfyingCount(v, ctx.opFace!) === 0);
}

/** P(el rival no pueda forzar TRUE) asumiendo su RAM uniforme en 1..6.
 *  Solo usa la CANTIDAD de numbers del rival, que es visible en la mesa. */
export function blockProbability(v: number, opFace: OperationFace, enemyCount: number): number {
  const s = satisfyingCount(v, opFace);
  return Math.pow((6 - s) / 6, enemyCount);
}

/** ¿Interceptar? El interceptor sustituye el d6 por un número de su RAM
 *  (lo consume, y solo puede interceptar una vez por ronda).
 *  N1: nunca.
 *  N2: solo si la primaria del rival es un ataque con objetivos y tiene un valor
 *      que bloquea garantizado (extremos con comparadores estrictos).
 *  N3: además acepta bloqueos probables (P ≥ 0.6 según cuántos numbers le queden
 *      al rival) y no lo gasta si la rama alternativa también ataca. */
export function decideIntercept(ctx: InterceptCtx): boolean {
  if (ctx.level === 1) return false;
  const op = ctx.op;
  if (!op || !ctx.opFace) return false;

  const primaryIsThreat = op.primary.type === 'attack'
    && computeAttackTargets(ctx.activeBot, op.primary, ctx.state.bots, ctx.state.hexMap, ctx.fmap, ctx.state.entities).size > 0;
  if (!primaryIsThreat) return false;

  if (ctx.level === 2) return guaranteedBlockingValues(ctx).length > 0;

  // N3
  const secondaryAlsoAttacks = op.kind === 'IF_ELSE' && op.secondary?.type === 'attack';
  if (secondaryAlsoAttacks) return false;
  const enemyCount = ctx.activeBot.numbers.length;
  return ctx.interceptor.numbers.some(v => blockProbability(v, ctx.opFace!, enemyCount) >= 0.6);
}

/** Número que sustituye al d6 del rival.
 *  N1: aleatorio. N2/N3: el de mayor probabilidad de bloqueo; a igualdad,
 *  N3 gasta el menos valioso para su propio futuro. */
export function chooseInterceptNumber(ctx: InterceptCtx, options: number[]): number {
  if (ctx.level === 1 || !ctx.opFace) return pickRandom(options, ctx.rand);
  const enemyCount = ctx.activeBot.numbers.length;
  let best = options[0];
  let bestScore = -Infinity;
  for (const v of options) {
    let score = blockProbability(v, ctx.opFace, enemyCount) * 10;
    if (ctx.level === 3) score -= numberFlexValue(v) * 0.01;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}
