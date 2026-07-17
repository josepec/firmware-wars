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

/** Valores propios que BLOQUEAN la rama TRUE del rival: sustituido el d6 por v,
 *  el rival no tiene ningún número n con evaluate(v, n, opFace) === true.
 *  (La RAM del rival es pública en el estado.) */
export function blockingValues(ctx: InterceptCtx): number[] {
  if (!ctx.opFace) return [];
  return ctx.interceptor.numbers.filter(v =>
    ctx.activeBot.numbers.every(n => !evaluate(v, n, ctx.opFace!)),
  );
}

/** ¿Interceptar? El interceptor sustituye el d6 por un número de su RAM
 *  (lo consume, y solo puede interceptar una vez por ronda).
 *  N1: nunca.
 *  N2: solo si la primaria del rival es un ataque con objetivos y algún número
 *      propio le impide forzar TRUE.
 *  N3: además exige que la rama alternativa no sea igual de peligrosa. */
export function decideIntercept(ctx: InterceptCtx): boolean {
  if (ctx.level === 1) return false;
  const op = ctx.op;
  if (!op) return false;
  if (blockingValues(ctx).length === 0) return false;

  const primaryIsThreat = op.primary.type === 'attack'
    && computeAttackTargets(ctx.activeBot, op.primary, ctx.state.bots, ctx.state.hexMap, ctx.fmap, ctx.state.entities).size > 0;
  if (!primaryIsThreat) return false;
  if (ctx.level === 2) return true;
  // N3: si al bloquear cae en una secundaria que también ataca, no gastes el intercept
  const secondaryAlsoAttacks = op.kind === 'IF_ELSE' && op.secondary?.type === 'attack';
  return !secondaryAlsoAttacks;
}

/** Número que sustituye al d6 del rival.
 *  N1: aleatorio. N2: el primero que bloquea. N3: el bloqueante menos valioso. */
export function chooseInterceptNumber(ctx: InterceptCtx, options: number[]): number {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const blocking = blockingValues(ctx).filter(v => options.includes(v));
  if (blocking.length === 0) return pickRandom(options, ctx.rand);
  if (ctx.level === 2) return blocking[0];
  return [...blocking].sort((a, b) => numberFlexValue(a) - numberFlexValue(b))[0];
}
