import type {
  BattleBot,
  BattleState,
  CompiledOperation,
  CpuLevel,
  FunctionCall,
} from '../../../../../shared/types/battle.types';
import { hexKey } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import type { RunState } from '../../simulator-run.utils';
import { computeAttackTargets, fnEnergyCost } from '../../simulator-run.utils';
import { evaluate } from '../../engine/dice';
import { hexDistance } from '../../engine/pathfinding';
import { objectiveBias, type AiObjective } from '../ai-objectives';
import { pickRandom, type RandomFn } from '../ai.types';
import {
  bestAttackRange,
  bestExpectedDamage,
  effectiveLife,
  expectedDamage,
  livingEnemies,
  nearestEnemy,
  numberFlexValue,
  parseHex,
  threatAt,
} from './ai-scoring';

/** Contexto común de las decisiones de RUN. */
export interface RunHeuristicCtx {
  state: BattleState;
  bot: BattleBot;
  runState: RunState;
  level: CpuLevel;
  objectives: AiObjective[];
  rand: RandomFn;
  fmap: Map<string, FunctionEntry>;
}

function currentOp(ctx: RunHeuristicCtx): CompiledOperation | null {
  return ctx.bot.compiledProgram?.operations[ctx.runState.opIdx] ?? null;
}

/** ¿Merece la pena ejecutar esta función ahora mismo? */
function fnUsefulness(ctx: RunHeuristicCtx, fn: FunctionCall | undefined): number {
  if (!fn) return -1;
  const { state, bot, fmap } = ctx;
  if (fn.type === 'attack') {
    const targets = computeAttackTargets(bot, fn, state.bots, state.hexMap, fmap, state.entities);
    if (targets.size === 0) return 0; // sin objetivo = ataque fallido (+1 bug)
    const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
    return 2 + expectedDamage(entry?.damage);
  }
  if (fn.type === 'shield') {
    if (bot.shield >= bot.maxShield) return 0;
    return bot.life < bot.maxLife * 0.5 ? 3 : 1;
  }
  // move: útil si hay distancia que cerrar (o que abrir, con vida baja)
  const enemy = nearestEnemy(state, bot);
  if (!enemy) return 0;
  const d = hexDistance(bot.q, bot.r, enemy.q, enemy.r);
  const range = bestAttackRange(bot, fmap);
  if (bot.life < bot.maxLife * 0.35) return 2.5;
  return d > range ? 2 : 0.5;
}

/** Número de RAM para evaluar la condición. La IA conoce ya d6 y comparador
 *  (runState.d6 / runState.opFace), así que puede FORZAR la rama que le convenga.
 *  N1: aleatorio.
 *  N2: fuerza TRUE si la primaria es útil, si no FALSE (o la secundaria si es mejor).
 *  N3: igual, gastando el número menos valioso que logre la rama (economía de RAM). */
export function choosePickNumber(ctx: RunHeuristicCtx, options: number[]): number {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const { runState: rs } = ctx;
  const op = currentOp(ctx);
  if (rs.d6 === null || !rs.opFace || !op) return pickRandom(options, ctx.rand);

  // FOR: |d6 − n| = iteraciones (0 o >3 → bug). Busca diff pagable.
  if (op.kind === 'FOR') {
    const iterCost = fnEnergyCost(op.primary, ctx.fmap);
    const maxPayable = iterCost > 0 ? Math.floor(ctx.bot.energy / iterCost) : 3;
    const targetIters = ctx.level === 3
      ? Math.max(1, Math.min(3, maxPayable))
      : Math.min(2, Math.max(1, maxPayable));
    let best = options[0];
    let bestScore = -Infinity;
    for (const n of options) {
      const diff = Math.abs(rs.d6 - n);
      const valid = diff >= 1 && diff <= 3;
      const score = (valid ? 10 : -10) - Math.abs(diff - targetIters) * 2
        - (ctx.level === 3 ? numberFlexValue(n) * 0.1 : 0);
      if (score > bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  // IF / IF_ELSE / WHILE: elegir rama y forzarla
  const primaryValue = fnUsefulness(ctx, op.primary);
  const secondaryValue = op.kind === 'IF_ELSE' ? fnUsefulness(ctx, op.secondary) : 0;
  let wantTrue = primaryValue >= secondaryValue && primaryValue > 0;
  if (op.kind === 'WHILE') {
    // Cada iteración consume un número y energía: solo repetir si es útil y pagable
    const iterCost = fnEnergyCost(op.primary, ctx.fmap);
    wantTrue = primaryValue > 0 && ctx.bot.energy >= iterCost;
  }

  const forcing = options.filter(n => evaluate(rs.d6!, n, rs.opFace!) === wantTrue);
  const candidates = forcing.length > 0 ? forcing : options;
  if (ctx.level === 2) return candidates[0];
  // N3: gasta el número con menos flexibilidad futura
  return [...candidates].sort((a, b) => numberFlexValue(a) - numberFlexValue(b))[0];
}

/** Puntuación de un hex como posición del bot (N3). */
function scoreHexPosition(ctx: RunHeuristicCtx, q: number, r: number): number {
  const { state, bot, fmap } = ctx;
  const enemy = nearestEnemy(state, bot);
  const range = Math.max(1, bestAttackRange(bot, fmap));
  const lifeRatio = bot.life / bot.maxLife;
  const threatWeight = lifeRatio < 0.35 ? 3 : 1;
  let score = 0;
  if (enemy) {
    const d = hexDistance(q, r, enemy.q, enemy.r);
    // Acercarse hasta el alcance de ataque; con vida baja, alejarse
    score -= (lifeRatio < 0.35 ? -d : Math.abs(d - range)) * 1.5;
    if (d <= range) score += bestExpectedDamage(bot, fmap);
  }
  score -= threatAt(state, bot, q, r, fmap) * 0.5 * threatWeight;
  // Corona de nodos relay hostiles
  for (const e of state.entities ?? []) {
    if (e.kind === 'relay_node' && e.life > 0 && hexDistance(q, r, e.q, e.r) === 1) score -= 2;
  }
  score += objectiveBias(ctx.objectives, { kind: 'move', botId: bot.id, hex: { q, r } });
  return score;
}

/** Hex de destino para move().
 *  N1: aleatorio. N2: acercarse al enemigo más próximo. N3: scoring posicional. */
export function chooseMoveHex(ctx: RunHeuristicCtx, options: string[]): string {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  if (ctx.level === 2) {
    const enemy = nearestEnemy(ctx.state, ctx.bot);
    if (!enemy) return pickRandom(options, ctx.rand);
    return [...options].sort((a, b) => {
      const pa = parseHex(a); const pb = parseHex(b);
      return hexDistance(pa.q, pa.r, enemy.q, enemy.r) - hexDistance(pb.q, pb.r, enemy.q, enemy.r);
    })[0];
  }
  return [...options].sort((a, b) => {
    const pa = parseHex(a); const pb = parseHex(b);
    return scoreHexPosition(ctx, pb.q, pb.r) - scoreHexPosition(ctx, pa.q, pa.r);
  })[0];
}

/** Objetivo de ataque (clave de hex entre los resaltados).
 *  N1: aleatorio. N2: menor vida efectiva. N3: valor (kill > daño − sobrematar > amenaza). */
export function chooseTargetHex(ctx: RunHeuristicCtx, options: string[]): string {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const { state, bot, fmap } = ctx;
  const botAt = (k: string) => {
    const { q, r } = parseHex(k);
    return state.bots.find(b => !b.destroyed && b.q === q && b.r === r) ?? null;
  };
  const botOptions = options.filter(k => botAt(k) !== null);
  // Entidades (barreras/nodos) solo si no hay bots a tiro
  if (botOptions.length === 0) return pickRandom(options, ctx.rand);

  if (ctx.level === 2) {
    return [...botOptions].sort((a, b) => effectiveLife(botAt(a)!) - effectiveLife(botAt(b)!))[0];
  }

  const fn = ctx.runState.pendingFn;
  const entry = fn?.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const dmg = expectedDamage(entry?.damage);
  let best = botOptions[0];
  let bestScore = -Infinity;
  for (const k of botOptions) {
    const target = botAt(k)!;
    const eff = effectiveLife(target);
    const kill = dmg >= eff;
    const score = (kill ? 100 : 0)
      + Math.min(dmg, eff)                       // daño real aplicable (anti-sobrematar)
      + bestExpectedDamage(target, fmap) * 0.5   // priorizar amenazas
      - (bot.playerId === target.playerId ? 1000 : 0)
      + objectiveBias(ctx.objectives, { kind: 'target', botId: bot.id, targetId: target.id });
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

/** Hexes de los pasos especiales (dash, shadowStep, barrera, nodo relay). */
export function chooseSpecialHex(
  ctx: RunHeuristicCtx,
  kind: 'dash-hex' | 'shadow-hex' | 'barrier-hex' | 'relay-hex',
  options: string[],
): string {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const { state, bot } = ctx;
  const enemy = nearestEnemy(state, bot);
  if (!enemy) return pickRandom(options, ctx.rand);

  if (kind === 'dash-hex' || kind === 'shadow-hex') {
    // Reposicionamiento: mismo criterio que move
    return chooseMoveHex(ctx, options);
  }
  if (kind === 'barrier-hex') {
    // En la línea entre el bot y el enemigo: minimiza dist(hex,yo)+dist(hex,enemigo)
    return [...options].sort((a, b) => {
      const pa = parseHex(a); const pb = parseHex(b);
      const la = hexDistance(pa.q, pa.r, bot.q, bot.r) + hexDistance(pa.q, pa.r, enemy.q, enemy.r);
      const lb = hexDistance(pb.q, pb.r, bot.q, bot.r) + hexDistance(pb.q, pb.r, enemy.q, enemy.r);
      return la - lb;
    })[0];
  }
  // relay-hex: maximizar cruces esperados de corona (enemigos cerca, aliados lejos)
  let best = options[0];
  let bestScore = -Infinity;
  for (const k of options) {
    const { q, r } = parseHex(k);
    let score = 0;
    for (const b of state.bots) {
      if (b.destroyed) continue;
      const d = hexDistance(q, r, b.q, b.r);
      if (d <= 2) score += b.playerId !== bot.playerId ? 3 - d : -(3 - d);
    }
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

/** chargedStrike: seguir tirando d4 (acumula, 1 = bust y se autoinflige) o plantarse.
 *  N1: 50/50. N2: plantarse con acum ≥ 3.
 *  N3: seguir mientras EV(seguir) > EV(parar); plantarse si ya asegura el kill. */
export function chooseChargedAction(ctx: RunHeuristicCtx): 'more' | 'stop' {
  const accum = ctx.runState.chargedAccum;
  if (accum <= 0) return 'more';
  if (ctx.level === 1) return ctx.rand() < 0.5 ? 'more' : 'stop';
  if (ctx.level === 2) return accum >= 3 ? 'stop' : 'more';

  const targetId = ctx.runState.chargedTargetId;
  const target = targetId ? ctx.state.bots.find(b => b.id === targetId) : null;
  if (target && accum >= effectiveLife(target)) return 'stop';
  // EV(seguir) = 3/4·(accum + 3) − 1/4·accum (bust: pierde el daño y se lo autoinflige)
  const evMore = 0.75 * (accum + 3) - 0.25 * accum;
  return evMore > accum ? 'more' : 'stop';
}

/** Re-export para el controlador (elige el hex del objetivo con la clave del hex). */
export function hexKeyOf(b: BattleBot): string {
  return hexKey(b.q, b.r);
}

/** Enemigos vivos accesibles como utilidad para specs. */
export { livingEnemies };
