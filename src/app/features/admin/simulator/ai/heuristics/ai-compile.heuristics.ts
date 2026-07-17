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
import { attackEntries, attackTacticalBonus, bestAttackRange, expectedDamage, nearestEnemy } from './ai-scoring';

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

/** Mejor ataque para la situación: daño esperado, con bonus si ya alcanza al
 *  enemigo desde la posición actual y penalización por coste. */
function bestAttackFn(
  bot: BattleBot,
  enemyDist: number,
  fmap: Map<string, FunctionEntry>,
): { fn: FunctionCall; range: number; cost: number; dmg: number } | null {
  let best: { fn: FunctionCall; range: number; cost: number; dmg: number; score: number } | null = null;
  for (const { fn, entry } of attackEntries(bot, fmap)) {
    const dmg = expectedDamage(entry.damage);
    const cost = parseEnergy(entry.energy);
    const range = parseRangeMax(entry.range);
    const score = dmg
      + attackTacticalBonus(fn.attackFunctionId)
      + (enemyDist <= range ? 2 : 0)
      - cost * 0.2;
    if (!best || score > best.score) best = { fn, range, cost, dmg, score };
  }
  return best;
}

/** Deseo de ejecutar una función, con `repeat` para preferir asignarle el loop. */
interface Wish {
  fn: FunctionCall;
  repeat?: boolean;
}

/** Orden de preferencia de operación según el tipo de función:
 *  - attack → TRY_CATCH primero: el motor solo ejecuta el TRY si hay energía Y
 *    objetivos; si no, cae al CATCH. Un ataque dentro de TRY_CATCH nunca falla en vacío.
 *  - move → IF simple (barato de forzar); FOR si hay que repetir (1 número, hasta 3 moves).
 *  - shield → IF simple.
 *  El loop solo se asigna a wishes marcadas repeat. */
function opPreference(wish: Wish): (k: OperationKind) => number {
  const isLoop = (k: OperationKind) => k === 'FOR' || k === 'WHILE';
  if (wish.fn.type === 'attack') {
    return k => {
      if (isLoop(k)) return wish.repeat ? 0 : 9;
      if (k === 'TRY_CATCH') return 1;
      if (k === 'IF') return 2;
      return 3; // IF_ELSE
    };
  }
  if (wish.fn.type === 'move') {
    return k => {
      if (k === 'FOR') return wish.repeat ? 0 : 8;
      if (k === 'WHILE') return wish.repeat ? 1 : 9;
      if (k === 'IF') return 2;
      if (k === 'IF_ELSE') return 3;
      return 4; // TRY_CATCH: se ejecuta siempre — válido para move
    };
  }
  return k => {
    if (isLoop(k)) return 9;
    if (k === 'IF') return 0;
    if (k === 'IF_ELSE') return 1;
    return 2;
  };
}

/** Secundaria (rama FALSE / CATCH) coherente con la primaria:
 *  ataque → repliegue (move si hay que acercarse, shield si no);
 *  move/shield → ataque oportunista si existe, si no la otra defensa. */
function pickSecondary(
  wish: Wish,
  fns: FunctionCall[],
  attack: FunctionCall | null,
  approaching: boolean,
): FunctionCall | undefined {
  const alt = fns.filter(f => funcSig(f) !== funcSig(wish.fn));
  if (alt.length === 0) return undefined;
  if (wish.fn.type === 'attack') {
    const move = alt.find(f => f.type === 'move');
    const shield = alt.find(f => f.type === 'shield');
    return (approaching ? move : shield) ?? alt[0];
  }
  if (attack && alt.some(f => f.type === 'attack')) return attack;
  return alt.find(f => f.type !== wish.fn.type) ?? alt[0];
}

/** Empareja la lista de deseos con las operaciones del pool respetando slots,
 *  ≤1 loop y firmas distintas en primaria/secundaria. */
function assembleProgram(
  wishes: Wish[],
  bot: BattleBot,
  fns: FunctionCall[],
  attack: FunctionCall | null,
  approaching: boolean,
): CompiledProgram {
  const slots = Math.max(0, bot.maxOperations - bot.bugs);
  const pool = [...bot.pendingOperations];
  const operations: CompiledOperation[] = [];
  let loopUsed = false;

  for (const wish of wishes) {
    if (operations.length >= slots || pool.length === 0) break;
    const pref = opPreference(wish);
    const usable = pool.filter(k => !((k === 'FOR' || k === 'WHILE') && loopUsed));
    if (usable.length === 0) break;
    usable.sort((a, b) => pref(a) - pref(b));
    const kind = usable[0];
    pool.splice(pool.indexOf(kind), 1);
    if (kind === 'FOR' || kind === 'WHILE') loopUsed = true;

    const op: CompiledOperation = { kind, primary: wish.fn };
    if (hasSecondarySlot(kind)) {
      op.secondary = pickSecondary(wish, fns, attack, approaching);
    }
    operations.push(op);
  }
  return { operations };
}

/** Construye el programa del bot respetando todas las reglas del editor.
 *
 *  N1: ops y funciones aleatorias (válidas).
 *  N2/N3: PLAN DE TURNO — calcula cuántos moves necesita para poner al enemigo
 *  a alcance (movesNeeded), y solo programa ataques que podrá ejecutar:
 *  - Ya a alcance → ráfaga de ataques (N3 limita al presupuesto de energía).
 *  - Alcanzable tras moverse → moves primero (FOR(move) si hacen falta varios:
 *    un número, hasta 3 movimientos), después ataques.
 *  - Inalcanzable este turno → aproximación a fondo; NADA de ataques que solo
 *    pueden fallar (un MISS = +1 bug).
 *  Con vida baja intercala shield; el loop nunca cae en un ataque sin objetivo. */
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

  // ── N2 / N3: plan de turno ──
  const enemy = nearestEnemy(state, bot);
  const enemyDist = enemy ? hexDistance(bot.q, bot.r, enemy.q, enemy.r) : Infinity;
  const attack = fns.some(f => f.type === 'attack') ? bestAttackFn(bot, enemyDist, fmap) : null;
  const lowLife = bot.life < bot.maxLife * 0.4;
  const threatened = enemy
    ? enemyDist <= enemy.maxMovement + Math.max(1, bestAttackRange(enemy, fmap))
    : false;
  const stride = Math.max(1, bot.maxMovement);
  const movesNeeded = enemy && attack
    ? Math.max(0, Math.ceil((enemyDist - attack.range) / stride))
    : (enemy ? slots : 0);

  const wishes: Wish[] = [];
  const moveWish = (repeat = false): Wish => ({ fn: { type: 'move' }, repeat });
  const shieldWish = (): Wish => ({ fn: { type: 'shield' } });

  if (attack && enemy && movesNeeded === 0) {
    // Ya a alcance: ráfaga
    if (lowLife && threatened) wishes.push(shieldWish());
    const nAtk = level === 3 && attack.cost > 0
      ? Math.max(1, Math.min(slots, Math.floor(bot.energy / attack.cost)))
      : slots;
    for (let i = 0; i < nAtk; i++) wishes.push({ fn: attack.fn, repeat: i === 0 && nAtk >= 2 });
  } else if (attack && enemy && movesNeeded <= Math.max(1, slots - 1)) {
    // Alcanzable tras acercarse: moves y después ataques
    if (lowLife && threatened) wishes.push(shieldWish());
    for (let i = 0; i < movesNeeded; i++) wishes.push(moveWish(i === 0 && movesNeeded >= 2));
    const remaining = slots - wishes.length;
    let nAtk = remaining;
    if (level === 3 && attack.cost > 0) {
      const budget = Math.max(0, bot.energy - movesNeeded * stride);
      nAtk = Math.min(remaining, Math.max(1, Math.floor(budget / attack.cost)));
    }
    for (let i = 0; i < nAtk; i++) wishes.push({ fn: attack.fn });
  } else {
    // Inalcanzable este turno (o sin ataques): aproximación a fondo, nada de misses
    wishes.push(moveWish(true));
    while (wishes.length < slots) wishes.push(lowLife ? shieldWish() : moveWish());
  }
  while (wishes.length < slots) wishes.push(moveWish());

  const approaching = movesNeeded > 0;
  const program = assembleProgram(wishes, bot, fns, attack?.fn ?? null, approaching);
  if (program.operations.length > 0) return program;
  // Red de seguridad: si la plantilla no pudo emparejar nada, programa aleatorio
  return buildProgram(bot, state, fmap, 1, objectives, rand);
}
