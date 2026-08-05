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
import { computeAttackTargets, fnEnergyCost, parseEnergy, parseRangeMax } from '../../simulator-run.utils';
import { hexDistance } from '../../engine/pathfinding';
import type { AiObjective } from '../ai-objectives';
import { pickRandom, type RandomFn } from '../ai.types';
import { attackEntries, attackTacticalBonus, bestAttackRange, expectedDamage, nearestEnemy } from './ai-scoring';
import { chooseFocusTarget } from './ai-team.heuristics';

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

function fnKey(f: FunctionCall): string {
  return f.type === 'attack' ? `attack:${f.attackFunctionId}` : f.type;
}

/** Última barrera antes de onCompileCommit: la IA NO pasa por el CompileEditor,
 *  así que este saneado garantiza que ningún programa suyo viole las reglas que
 *  el editor impone a los humanos —
 *  ops del pool (cada una una vez) · ≤ slots (maxOperations − bugs) · máx. 1 loop ·
 *  funciones que el bot posee (versión/DMZ) · secundaria solo en IF_ELSE/TRY_CATCH
 *  y SIEMPRE de distinta firma (todos los ataques comparten firma: jamás ataque/ataque). */
export function sanitizeProgram(bot: BattleBot, program: CompiledProgram): CompiledProgram {
  const slots = Math.max(0, bot.maxOperations - bot.bugs);
  const pool = [...bot.pendingOperations];
  const allowed = new Set(availableFunctions(bot).map(fnKey));
  const out: CompiledOperation[] = [];
  let loopUsed = false;
  for (const op of program.operations) {
    if (out.length >= slots) break;
    const poolIdx = pool.indexOf(op.kind);
    if (poolIdx < 0) continue;
    const isLoop = op.kind === 'FOR' || op.kind === 'WHILE';
    if (isLoop && loopUsed) continue;
    if (!allowed.has(fnKey(op.primary))) continue;
    const clean: CompiledOperation = { kind: op.kind, primary: op.primary };
    if (
      hasSecondarySlot(op.kind) && op.secondary
      && funcSig(op.secondary) !== funcSig(op.primary)
      && allowed.has(fnKey(op.secondary))
    ) {
      clean.secondary = op.secondary;
    }
    pool.splice(poolIdx, 1);
    if (isLoop) loopUsed = true;
    out.push(clean);
  }
  return { operations: out };
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
 *  move/shield → ataque oportunista SOLO si ahora mismo tiene objetivos.
 *
 *  Ese `attackUsable` no es cosmético. La rama secundaria puede dispararse
 *  ANTES de que el bot se haya movido — es la rama FALSE de la primera
 *  operación — así que hay que juzgarla desde la posición actual. Y forzar la
 *  rama que uno quiere no siempre se puede: con cara `==` solo se fuerza TRUE
 *  teniendo exactamente el valor del d6, y con `!=` solo FALSE igual, de modo
 *  que si el número no está en RAM la IA cae en la rama que no quería. Un
 *  ataque ahí = MISS + 1 bug garantizado. */
function pickSecondary(
  wish: Wish,
  fns: FunctionCall[],
  attack: FunctionCall | null,
  approaching: boolean,
  attackUsable: boolean,
): FunctionCall | undefined {
  const alt = fns.filter(f => funcSig(f) !== funcSig(wish.fn));
  if (alt.length === 0) return undefined;
  if (wish.fn.type === 'attack') {
    const move = alt.find(f => f.type === 'move');
    const shield = alt.find(f => f.type === 'shield');
    return (approaching ? move : shield) ?? alt[0];
  }
  if (attack && attackUsable && alt.some(f => f.type === 'attack')) return attack;
  return alt.find(f => f.type !== wish.fn.type && f.type !== 'attack')
    ?? alt.find(f => f.type !== 'attack');
}

/** Energía mínima que hay que reservar para que un deseo NO acabe en overload.
 *
 *  Un `move` cuesta 1 aquí, no el movimiento máximo: el motor cobra por hex
 *  realmente recorrido y `chooseMoveHex` ya limita la distancia a la energía
 *  disponible, así que un move con 1⚡ se ejecuta corto pero se ejecuta. Los
 *  ataques y el escudo sí son un compromiso cerrado — o se paga el coste
 *  entero o hay overload — y por eso se cuentan a precio completo.
 *  (Cuánta energía se comen los moves de aproximación antes de los ataques ya
 *  se descuenta aparte, en el `budget` del plan de turno.)
 *
 *  Un deseo `repeat` aspira a ir en un bucle: se cobran `loopIters` vueltas. */
function wishCost(
  wish: Wish,
  bot: BattleBot,
  fmap: Map<string, FunctionEntry>,
  loopIters: number,
): number {
  const unit = wish.fn.type === 'move' ? 1 : fnEnergyCost(wish.fn, fmap, bot);
  return wish.repeat ? unit * loopIters : unit;
}

/** Vueltas que hay que presupuestar para un deseo marcado `repeat`.
 *
 *  El `repeat` es una PREFERENCIA por el bucle, no una garantía: si en el pool
 *  no ha salido ningún FOR/WHILE, el deseo acaba en un IF y se ejecuta una sola
 *  vez. Cobrarle vueltas de más en ese caso dejaba al bot compilando una
 *  operación cuando podía pagar tres.
 *
 *  Y cuando sí hay bucle, el número tiene que coincidir con el que va a pedir
 *  `choosePickNumber` en RUN — 3 iteraciones en N3, 2 en N2 — o el presupuesto
 *  se queda corto y la operación siguiente entra en overload. */
function loopIterations(bot: BattleBot, level: CpuLevel): number {
  const hasLoop = bot.pendingOperations.some(k => k === 'FOR' || k === 'WHILE');
  if (!hasLoop) return 1;
  return level === 3 ? 3 : 2;
}

/** Recorta el plan a lo que el bot puede PAGAR.
 *
 *  Ejecutar una función sin energía suficiente no es un no-op: el motor cobra
 *  OVERLOAD y el bot pierde vida = coste − energía. Un programa de tres ataques
 *  de 5⚡ con 10⚡ en el depósito no hace tres ataques, hace dos y se
 *  autolesiona. Compilar de menos no cuesta nada a cambio: las operaciones se
 *  vuelven a tirar enteras en el BOOT del turno siguiente, no se acumulan. */
function trimToEnergy(
  wishes: Wish[],
  bot: BattleBot,
  fmap: Map<string, FunctionEntry>,
  loopIters: number,
): Wish[] {
  let left = bot.energy;
  const out: Wish[] = [];
  for (const wish of wishes) {
    let w = wish;
    let cost = wishCost(w, bot, fmap, loopIters);
    /* No llega para todas las vueltas del bucle: antes de descartar el deseo,
       degradarlo a ejecución simple. El bucle no es un compromiso rígido — en
       RUN, `choosePickNumber` ya limita las iteraciones a lo pagable. Sin este
       paso, un primer deseo caro tumbaba el programa entero. */
    if (cost > left && w.repeat) {
      w = { ...w, repeat: false };
      cost = wishCost(w, bot, fmap, loopIters);
    }
    if (cost > left) break;
    left -= cost;
    out.push(w);
  }
  return out;
}

/** Empareja la lista de deseos con las operaciones del pool respetando slots,
 *  ≤1 loop y firmas distintas en primaria/secundaria. */
function assembleProgram(
  wishes: Wish[],
  bot: BattleBot,
  fns: FunctionCall[],
  attack: FunctionCall | null,
  approaching: boolean,
  attackUsable: boolean,
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

    /* Cuando en el pool solo quedan bucles, `opPreference` no sirve de nada: el
       deseo se lleva el FOR aunque lo puntúe con un 9. Y un bucle con un ataque
       que HOY no tiene objetivos es un bug seguro — o falla la condición y es
       "bucle fallido", o entra y falla una vez por vuelta. Mejor dejar el slot
       sin compilar: las operaciones se vuelven a tirar en el BOOT siguiente. */
    if ((kind === 'FOR' || kind === 'WHILE') && wish.fn.type === 'attack' && !attackUsable) {
      continue;
    }

    pool.splice(pool.indexOf(kind), 1);
    if (kind === 'FOR' || kind === 'WHILE') loopUsed = true;

    const op: CompiledOperation = { kind, primary: wish.fn };
    if (hasSecondarySlot(kind)) {
      op.secondary = pickSecondary(wish, fns, attack, approaching, attackUsable);
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
    return sanitizeProgram(bot, { operations });
  }

  // ── N2 / N3: plan de turno contra el objetivo de foco del equipo ──
  const enemy = chooseFocusTarget(state, bot.playerId, fmap) ?? nearestEnemy(state, bot);
  const enemyDist = enemy ? hexDistance(bot.q, bot.r, enemy.q, enemy.r) : Infinity;
  const attack = fns.some(f => f.type === 'attack') ? bestAttackFn(bot, enemyDist, fmap) : null;
  const lowLife = bot.life < bot.maxLife * 0.4;
  const threatened = enemy
    ? enemyDist <= enemy.maxMovement + Math.max(1, bestAttackRange(enemy, fmap))
    : false;
  const stride = Math.max(1, bot.maxMovement);
  // "A tiro" se decide con los OBJETIVOS REALES del ataque, no con la distancia:
  // un arma LR (línea recta) alcanza 8 hexes pero solo en los 6 ejes, y la LOS
  // puede estar bloqueada. Distancia ≤ rango sin objetivo real → hay que moverse.
  const inRangeNow = attack !== null
    && computeAttackTargets(bot, attack.fn, state.bots, state.hexMap, fmap, state.entities).size > 0;
  const movesNeeded = enemy && attack
    ? Math.max(inRangeNow ? 0 : 1, Math.ceil(Math.max(0, enemyDist - attack.range) / stride))
    : (enemy ? slots : 0);

  const wishes: Wish[] = [];
  const moveWish = (repeat = false): Wish => ({ fn: { type: 'move' }, repeat });
  const shieldWish = (): Wish => ({ fn: { type: 'shield' } });

  if (attack && enemy && inRangeNow) {
    // Ya a alcance: ráfaga
    if (lowLife && threatened) wishes.push(shieldWish());
    // El presupuesto de energía vale para N2 y N3 por igual: programar más
    // ataques de los pagables no da más ataques, da OVERLOAD (vida perdida).
    const nAtk = attack.cost > 0
      ? Math.max(1, Math.min(slots, Math.floor(bot.energy / attack.cost)))
      : slots;
    for (let i = 0; i < nAtk; i++) wishes.push({ fn: attack.fn, repeat: i === 0 && nAtk >= 2 });
  } else if (attack && enemy && movesNeeded <= Math.max(1, slots - 1)) {
    // Alcanzable tras acercarse: moves y después ataques
    if (lowLife && threatened) wishes.push(shieldWish());
    for (let i = 0; i < movesNeeded; i++) wishes.push(moveWish(i === 0 && movesNeeded >= 2));
    const remaining = slots - wishes.length;
    let nAtk = remaining;
    if (attack.cost > 0) {
      const budget = Math.max(0, bot.energy - movesNeeded * stride);
      nAtk = Math.min(remaining, Math.max(1, Math.floor(budget / attack.cost)));
    }
    for (let i = 0; i < nAtk; i++) wishes.push({ fn: attack.fn });
  } else {
    // Inalcanzable este turno (o sin ataques): aproximación a fondo, nada de misses
    wishes.push(moveWish(true));
    while (wishes.length < slots) wishes.push(lowLife ? shieldWish() : moveWish());
  }

  /* Relleno de los slots que sobren. Antes se rellenaba SIEMPRE con `move`, y
     eso manda a pasear a un bot que ya está bien colocado: `move` puntúa
     positivo en RUN aunque el enemigo esté a tiro, así que se ejecuta y puede
     sacarlo del alcance que acababa de ganar. Solo se rellena con algo que
     aporte; si no hay nada, el programa se queda CORTO a propósito. */
  const canShield = bot.shield < bot.maxShield;
  while (wishes.length < slots) {
    if (movesNeeded > 0) { wishes.push(moveWish()); continue; }
    if (canShield && !wishes.some(w => w.fn.type === 'shield')) { wishes.push(shieldWish()); continue; }
    break;
  }

  const approaching = movesNeeded > 0;
  const payable = trimToEnergy(wishes, bot, fmap, loopIterations(bot, level));
  const program = sanitizeProgram(
    bot,
    assembleProgram(payable, bot, fns, attack?.fn ?? null, approaching, inRangeNow),
  );
  if (program.operations.length > 0) return program;
  /* Red de seguridad: si la plantilla no pudo emparejar nada, programa
     aleatorio. Ojo — solo cuando HABÍA algo pagable que emparejar. Si el plan
     quedó vacío porque el bot no puede permitirse nada, caer aquí sería
     justo lo contrario de lo que se busca: un programa al azar sin energía es
     overload garantizado. En ese caso, no compilar nada. */
  if (payable.length === 0) return { operations: [] };
  return buildProgram(bot, state, fmap, 1, objectives, rand);
}
