import type {
  BattleBot,
  BattleState,
  CompiledOperation,
  CompiledProgram,
  CpuLevel,
  FunctionCall,
  OperationKind,
} from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { parseEnergy, parseRangeMax } from '../../simulator-run.utils';
import { hexDistance } from '../../engine/pathfinding';
import type { AiObjective } from '../ai-objectives';
import { pickRandom, type RandomFn } from '../ai.types';
import { attackEntries, expectedDamage, nearestEnemy } from './ai-scoring';

/** Firma de función a efectos del editor: primaria y secundaria no pueden compartirla. */
function funcSig(fn: FunctionCall): string {
  return fn.type;
}

function hasSecondarySlot(op: OperationKind): boolean {
  return op === 'IF_ELSE' || op === 'TRY_CATCH';
}

function hasStatus(bot: BattleBot, kind: string): boolean {
  return (bot.statusEffects ?? []).some(s => s.kind === kind);
}

/** Funciones asignables a un slot, replicando las reglas del CompileEditor:
 *  move/shield siempre; ataques por versión del bot; DMZ bloquea los ataques. */
export function availableFunctions(bot: BattleBot): FunctionCall[] {
  const out: FunctionCall[] = [{ type: 'move' }, { type: 'shield' }];
  if (hasStatus(bot, 'DMZ')) return out;
  const addRefs = (refs: ({ functionId: string } | null)[]) => {
    for (const ref of refs) {
      if (ref) out.push({ type: 'attack', attackFunctionId: ref.functionId });
    }
  };
  addRefs(bot.attacks.v1);
  if (bot.version >= 2) addRefs(bot.attacks.v2);
  if (bot.version >= 3 && bot.attacks.v3) addRefs([bot.attacks.v3]);
  return out;
}

function shuffled<T>(items: readonly T[], rand: RandomFn): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mejor ataque por daño esperado que el bot puede costear (aprox.). */
function bestAttackFn(
  bot: BattleBot,
  fmap: Map<string, FunctionEntry>,
): { fn: FunctionCall; range: number; cost: number } | null {
  let best: { fn: FunctionCall; range: number; cost: number; dmg: number } | null = null;
  for (const { fn, entry } of attackEntries(bot, fmap)) {
    const dmg = expectedDamage(entry.damage);
    const cost = parseEnergy(entry.energy);
    if (!best || dmg > best.dmg) best = { fn, range: parseRangeMax(entry.range), cost, dmg };
  }
  return best;
}

/** Empareja una lista deseada de funciones con las operaciones del pool,
 *  respetando slots, ≤1 loop y firmas distintas en primaria/secundaria. */
function assembleProgram(
  wishlist: FunctionCall[],
  bot: BattleBot,
  fns: FunctionCall[],
  rand: RandomFn,
): CompiledProgram {
  const slots = Math.max(0, bot.maxOperations - bot.bugs);
  const pool = [...bot.pendingOperations];
  const operations: CompiledOperation[] = [];
  let loopUsed = false;

  // Orden de preferencia de ops: IF simples primero, condicionales dobles después,
  // el loop (si lo hay) se asigna al primer ataque de la wishlist.
  const takeOp = (preferLoop: boolean): OperationKind | null => {
    const order = (k: OperationKind): number => {
      const isLoop = k === 'FOR' || k === 'WHILE';
      if (isLoop) return preferLoop && !loopUsed ? 0 : 3;
      if (k === 'IF') return 1;
      return 2; // IF_ELSE / TRY_CATCH
    };
    const usable = pool.filter(k => !((k === 'FOR' || k === 'WHILE') && loopUsed));
    if (usable.length === 0) return null;
    usable.sort((a, b) => order(a) - order(b));
    const k = usable[0];
    pool.splice(pool.indexOf(k), 1);
    if (k === 'FOR' || k === 'WHILE') loopUsed = true;
    return k;
  };

  for (const wish of wishlist) {
    if (operations.length >= slots) break;
    const kind = takeOp(wish.type === 'attack');
    if (!kind) break;
    const op: CompiledOperation = { kind, primary: wish };
    if (hasSecondarySlot(kind)) {
      const alt = fns.filter(f => funcSig(f) !== funcSig(wish));
      if (alt.length > 0) {
        // Rama alternativa: si la primaria ataca, la secundaria repliega (move/shield);
        // si la primaria es move/shield, la secundaria aprovecha para atacar.
        const attackAlt = alt.filter(f => f.type === 'attack');
        const fallback = alt.find(f => f.type === 'shield') ?? alt[0];
        op.secondary = wish.type === 'attack' ? fallback : (attackAlt[0] ?? pickRandom(alt, rand));
      }
    }
    operations.push(op);
  }
  return { operations };
}

/** Construye el programa del bot respetando todas las reglas del editor:
 *  ops del pool (cada una una vez), ≤ slots (maxOperations − bugs), máx. 1 loop,
 *  primaria obligatoria, secundaria (IF_ELSE/TRY_CATCH) de distinta firma.
 *  N1: ops y funciones aleatorias.
 *  N2: plantilla greedy — acercarse si el enemigo está lejos, atacar lo mejor posible,
 *      escudo si la vida va baja.
 *  N3: como N2 con presupuesto de energía — no programa más ataques de los que puede
 *      pagar, y reserva el loop para el ataque si hay margen. */
export function buildProgram(
  bot: BattleBot,
  state: BattleState,
  fmap: Map<string, FunctionEntry>,
  level: CpuLevel,
  objectives: AiObjective[],
  rand: RandomFn,
): CompiledProgram {
  void objectives;
  const slots = Math.max(0, bot.maxOperations - bot.bugs);
  const fns = availableFunctions(bot);
  if (slots === 0 || bot.pendingOperations.length === 0 || fns.length === 0) {
    return { operations: [] };
  }

  if (level === 1) {
    const operations: CompiledOperation[] = [];
    let loopUsed = false;
    for (const kind of shuffled(bot.pendingOperations, rand)) {
      if (operations.length >= slots) break;
      const isLoop = kind === 'FOR' || kind === 'WHILE';
      if (isLoop && loopUsed) continue;
      if (isLoop) loopUsed = true;
      const primary = pickRandom(fns, rand);
      const op: CompiledOperation = { kind, primary };
      if (hasSecondarySlot(kind)) {
        const alt = fns.filter(f => funcSig(f) !== funcSig(primary));
        if (alt.length > 0) op.secondary = pickRandom(alt, rand);
      }
      operations.push(op);
    }
    return { operations };
  }

  // N2 / N3 — plantilla greedy sobre la situación actual
  const enemy = nearestEnemy(state, bot);
  const attack = bestAttackFn(bot, fmap);
  const canAttack = fns.some(f => f.type === 'attack') && attack !== null;
  const lowLife = bot.life < bot.maxLife * 0.4;
  const enemyDist = enemy ? hexDistance(bot.q, bot.r, enemy.q, enemy.r) : Infinity;

  const wishlist: FunctionCall[] = [];
  if (canAttack && enemy && enemyDist > attack!.range) wishlist.push({ type: 'move' });
  if (lowLife) wishlist.push({ type: 'shield' });
  if (canAttack) {
    // N3: presupuesto — nº de ataques que puede pagar tras el posible move
    let attacksToQueue = slots;
    if (level === 3 && attack) {
      const moveCost = wishlist.some(w => w.type === 'move') ? bot.maxMovement : 0;
      const budget = Math.max(0, bot.energy - moveCost - (lowLife ? 2 : 0));
      attacksToQueue = attack.cost > 0 ? Math.max(1, Math.floor(budget / attack.cost)) : slots;
    }
    for (let i = 0; i < attacksToQueue; i++) wishlist.push(attack!.fn);
  }
  if (wishlist.length === 0) wishlist.push({ type: 'move' });
  while (wishlist.length < slots) wishlist.push(canAttack ? attack!.fn : { type: 'move' });

  const program = assembleProgram(wishlist, bot, fns, rand);
  if (program.operations.length > 0) return program;
  // Red de seguridad: si la plantilla no pudo emparejar nada, programa aleatorio
  return buildProgram(bot, state, fmap, 1, objectives, rand);
}
