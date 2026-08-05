import type {
  BattleBot,
  BattleState,
  CompiledOperation,
  CpuLevel,
  FunctionCall,
} from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import type { RunState } from '../../simulator-run.utils';
import { computeAttackTargets, fnEnergyCost, parseRangeMax, parseRangeMin } from '../../simulator-run.utils';
import { evaluate } from '../../engine/dice';
import { hexDistance, reachableHexes } from '../../engine/pathfinding';
import { getAttackFn } from '../../attack-fns/index';
import { RELAY_NODE_MAX, relayNodesOf } from '../../simulator-relay-node.utils';
import { objectiveBias, type AiObjective } from '../ai-objectives';
import { pickRandom, type RandomFn } from '../ai.types';
import {
  attackEntries,
  attackTacticalBonus,
  bestAttackRange,
  bestExpectedDamage,
  effectiveLife,
  expectedDamage,
  nearestEnemy,
  numberFlexValue,
  parseHex,
  threatAt,
} from './ai-scoring';
import { allyClusterPenalty, chooseFocusTarget } from './ai-team.heuristics';

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

/** Utilidad de las funciones auto-dirigidas, cada una por su efecto real:
 *  curarse vale cuando falta vida, los buffs de daño solo si va a atacar ya,
 *  y berserk (x2 daño, 1d4 propio) nunca con la vida justa. */
function selfFnUsefulness(ctx: RunHeuristicCtx, id: string): number {
  const { state, bot, fmap } = ctx;
  const enemy = nearestEnemy(state, bot);
  const dEnemy = enemy ? hexDistance(bot.q, bot.r, enemy.q, enemy.r) : Infinity;
  const range = Math.max(1, bestAttackRange(bot, fmap));
  const engaged = dEnemy <= range + bot.maxMovement;
  switch (id) {
    case 'nanoRepair': // recupera 1d4 vida
      if (bot.life >= bot.maxLife) return 0;
      return bot.life < bot.maxLife * 0.5 ? 3.5 : 2;
    case 'shadowStep': // teleporte 3 hexes ignorando obstáculos
      if (bot.life < bot.maxLife * 0.35) return 3; // escape
      return dEnemy > range ? 2 : 0.5;
    case 'overclockStrike': // OVERCLOCK: +1 daño este turno — solo si va a atacar ya
      return engaged ? 2 : 0.5;
    case 'berserkProtocol': // BERSERK: x2 daño, pero 1d4 de autodaño
      return engaged && bot.life > bot.maxLife * 0.5 ? 2.5 : 0;
    case 'firewall': // SAFE_MODE: inmune a bugs este turno
      return 1;
    case 'deployBarrier':
      return enemy && dEnemy <= enemy.maxMovement + Math.max(1, bestAttackRange(enemy, fmap)) ? 1.5 : 0.5;
    case 'relayNode':
      if (relayNodesOf(state.entities, bot.id).length >= RELAY_NODE_MAX) return 0;
      return engaged ? 2 : 1;
    default:
      return 1.5;
  }
}

/** Golpes esperados necesarios para destruir todo lo que este ataque tiene a
 *  tiro (bots enemigos por vida efectiva; entidades por su vida). */
function hitsToClearTargets(ctx: RunHeuristicCtx, fn: FunctionCall): number {
  const { state, bot, fmap } = ctx;
  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const dmg = expectedDamage(entry?.damage);
  if (dmg <= 0) return Infinity; // sin daño estimable, no capar
  const targets = computeAttackTargets(bot, fn, state.bots, state.hexMap, fmap, state.entities);
  let hits = 0;
  for (const k of targets) {
    const { q, r } = parseHex(k);
    const b = state.bots.find(x => !x.destroyed && x.q === q && x.r === r);
    if (b) { hits += Math.ceil(effectiveLife(b) / dmg); continue; }
    const e = (state.entities ?? []).find(x => x.q === q && x.r === r);
    if (e) hits += Math.ceil(e.life / dmg);
  }
  return hits > 0 ? hits : Infinity;
}

/** Utilidad de ejecutar esta función AHORA. El signo importa:
 *  > 0 = aporta · 0 = no hace nada (o falla con bug evitable) · < 0 = se hace daño (overload).
 *
 *  Reglas del motor que codifica:
 *  - Ejecutar cualquier función sin energía suficiente = OVERLOAD (pierde vida). Nunca.
 *  - attack sin objetivos en rango = MISS + 1 bug. Mejor forzar la rama que lo evita.
 *  - shield con escudo lleno no aporta; con vida baja es prioritario.
 *  - move vale para cerrar distancia hasta el alcance de ataque, o para huir con vida baja. */
export function fnUsefulness(ctx: RunHeuristicCtx, fn: FunctionCall | undefined): number {
  if (!fn) return -1;
  const { state, bot, fmap } = ctx;

  if (fn.type === 'attack') {
    const cost = fnEnergyCost(fn, fmap, bot);
    if (cost > bot.energy) return -(cost - bot.energy) - 1; // overload seguro
    const targets = computeAttackTargets(bot, fn, state.bots, state.hexMap, fmap, state.entities);
    // Sin objetivo = MISS + 1 bug: NEGATIVO, no cero — en un IF_ELSE debe perder
    // contra cualquier rama inofensiva (p. ej. escudo lleno)
    if (targets.size === 0) return -2;
    const def = getAttackFn(fn.attackFunctionId);
    const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
    if (def?.rangeKind === 'self') {
      return selfFnUsefulness(ctx, def.id);
    }
    return 2 + expectedDamage(entry?.damage) + attackTacticalBonus(fn.attackFunctionId);
  }

  if (fn.type === 'shield') {
    if (bot.energy < 2) return -(2 - bot.energy) - 1;
    if (bot.shield >= bot.maxShield) return -0.5; // gasta 2⚡ para nada — pero sin bug
    return bot.life < bot.maxLife * 0.5 ? 3 : 1;
  }

  // move
  if (bot.energy <= 0) return -1; // move sin energía = overload 1
  const maxDist = Math.min(bot.maxMovement, bot.energy);
  const reachable = reachableHexes(bot.q, bot.r, maxDist, state.hexMap, state.bots, bot.id, state.entities);
  if (reachable.size === 0) return 0; // bloqueado: se resuelve sin penalización
  const enemy = nearestEnemy(state, bot);
  if (!enemy) return 0;
  const d = hexDistance(bot.q, bot.r, enemy.q, enemy.r);
  const range = Math.max(1, bestAttackRange(bot, fmap));
  const huyendo = bot.life < bot.maxLife * 0.35;

  /* Un move que se ejecuta OBLIGA a cambiar de hex: `reachableHexes` no incluye
     el de origen, así que no existe "quedarse quieto". Si ningún hex al alcance
     mejora nada — ni acerca, ni abre un tiro que ahora no hay, ni aleja cuando
     toca huir — moverse solo descoloca al bot y gasta energía. Se ha visto a un
     bot acorralado ir y volver entre dos casillas dentro del mismo turno. */
  const acerca = (dk: number) => (huyendo ? dk > d : dk < d);
  let mejora = false;
  for (const k of reachable) {
    const { q, r } = parseHex(k);
    if (acerca(hexDistance(q, r, enemy.q, enemy.r))) { mejora = true; break; }
  }
  if (!mejora && !huyendo && !canShootFrom(ctx, bot.q, bot.r)) {
    for (const k of reachable) {
      const { q, r } = parseHex(k);
      if (canShootFrom(ctx, q, r)) { mejora = true; break; }
    }
  }
  if (!mejora) return 0; // nada que ganar: mejor que la op se resuelva por otra vía

  if (huyendo) return 2.5;
  return d > range ? 2 : 0.5;
}

/** Número de RAM para evaluar la condición. La IA conoce ya d6 y comparador
 *  (runState.d6 / runState.opFace), así que puede FORZAR la rama que le convenga.
 *
 *  N1: aleatorio.
 *  N2/N3: decide la rama por utilidad real (objetivos a tiro, energía, overloads)
 *  y fuerza el resultado. N3 además gasta el número menos valioso que lo logre.
 *
 *  FOR es especial: |d6 − n| = iteraciones (0 o >3 = bug "infinite loop", sin ejecutar).
 *  Con primaria útil busca las iteraciones pagables; con primaria inútil elige diff 0:
 *  1 bug seco es más barato que 1 MISS+bug por iteración u overloads. */
export function choosePickNumber(ctx: RunHeuristicCtx, options: number[]): number {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const { runState: rs } = ctx;
  const op = currentOp(ctx);
  if (rs.d6 === null || !op) return pickRandom(options, ctx.rand);

  if (op.kind === 'FOR') {
    const useful = fnUsefulness(ctx, op.primary) > 0;
    const iterCost = fnEnergyCost(op.primary, ctx.fmap, ctx.bot);
    const maxPayable = iterCost > 0 ? Math.floor(ctx.bot.energy / iterCost) : 3;
    if (!useful) {
      // Minimizar daño: diff 0 si es posible (1 bug, cero ejecuciones), si no la mínima
      return [...options].sort((a, b) => Math.abs(rs.d6! - a) - Math.abs(rs.d6! - b))[0];
    }
    // FOR(ataque): no comprometer más iteraciones que golpes hacen falta para
    // acabar con lo que hay a tiro — un objetivo destruido a mitad de bucle deja
    // el resto de iteraciones disparando al vacío (MISS + 1 bug cada una).
    const killCap = op.primary.type === 'attack'
      ? hitsToClearTargets(ctx, op.primary)
      : Infinity;
    const targetIters = Math.max(1, Math.min(
      killCap,
      ctx.level === 3 ? Math.min(3, maxPayable) : Math.min(2, Math.max(1, maxPayable)),
    ));
    let best = options[0];
    let bestScore = -Infinity;
    for (const n of options) {
      const diff = Math.abs(rs.d6 - n);
      const valid = diff >= 1 && diff <= 3;
      let score = valid ? 10 : -10;
      score -= Math.abs(diff - targetIters) * 2;
      if (diff > maxPayable) score -= 8; // iteración impagable = overload
      if (ctx.level === 3) score -= numberFlexValue(n) * 0.1;
      if (score > bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  if (!rs.opFace) return pickRandom(options, ctx.rand);

  // IF / IF_ELSE / WHILE: elegir rama por utilidad y forzarla
  const primaryValue = fnUsefulness(ctx, op.primary);
  let wantTrue: boolean;
  if (op.kind === 'WHILE') {
    // Repetir solo si aporta y puede pagar la siguiente iteración.
    // Ojo: el primer FALSE de un WHILE = 1 bug ("bucle fallido") — inevitable si la
    // primaria no sirve; forzar TRUE inútil costaría 1 bug por MISS en cada vuelta.
    //
    // Y hay que reservar RAM: cada vuelta gasta un número, y un WHILE(move) con
    // el enemigo lejos quiere seguir SIEMPRE. En partidas reales se ha comido los
    // 8 números del turno dando vueltas, dejando el ataque de después en
    // "skipped: no-numbers" turno tras turno. Se guarda un número por cada
    // operación que queda por ejecutar.
    const opsPendientes = Math.max(
      0,
      (ctx.bot.compiledProgram?.operations.length ?? 0) - ctx.runState.opIdx - 1,
    );
    wantTrue = primaryValue > 0
      && ctx.bot.energy >= fnEnergyCost(op.primary, ctx.fmap, ctx.bot)
      && ctx.bot.numbers.length > opsPendientes;
  } else if (op.kind === 'IF_ELSE' && op.secondary) {
    // FALSE ejecuta la secundaria: comparar utilidades y quedarse con la mejor rama
    const secondaryValue = fnUsefulness(ctx, op.secondary);
    wantTrue = primaryValue >= secondaryValue;
  } else {
    wantTrue = primaryValue > 0;
  }

  const forcing = options.filter(n => evaluate(rs.d6!, n, rs.opFace!) === wantTrue);
  const candidates = forcing.length > 0 ? forcing : options;
  if (ctx.level === 2) return candidates[0];
  // N3: gasta el número con menos flexibilidad futura
  return [...candidates].sort((a, b) => numberFlexValue(a) - numberFlexValue(b))[0];
}

/** Enemigo de referencia para posicionarse: el foco del equipo, y si no, el más cercano. */
function referenceEnemy(ctx: RunHeuristicCtx): ReturnType<typeof nearestEnemy> {
  return chooseFocusTarget(ctx.state, ctx.bot.playerId, ctx.fmap) ?? nearestEnemy(ctx.state, ctx.bot);
}

/** ¿Tendría objetivos REALES desde este hex, con algún ataque que pueda pagar?
 *
 *  La distancia no basta y por eso hace falta esto: un arma LR solo dispara por
 *  los 6 ejes, un SLDV tiene sus propias reglas y la línea de visión puede estar
 *  cortada por un obstáculo o por otro bot. Un hex "a distancia de tiro" del que
 *  no sale ningún disparo no vale nada. */
function canShootFrom(ctx: RunHeuristicCtx, q: number, r: number): boolean {
  const { state, bot, fmap } = ctx;
  const moved = { ...bot, q, r };
  const bots = state.bots.map(b => (b.id === bot.id ? moved : b));
  for (const { fn } of attackEntries(bot, fmap)) {
    if (fnEnergyCost(fn, fmap, moved) > bot.energy) continue;
    if (computeAttackTargets(moved, fn, bots, state.hexMap, fmap, state.entities).size > 0) {
      return true;
    }
  }
  return false;
}

/** Banda de distancias en la que el bot puede disparar ALGO: del mínimo más
 *  corto al máximo más largo de sus ataques.
 *
 *  El mínimo importa tanto como el máximo y es el que se olvida: `laserBeam` es
 *  2-8 y `railgun` tampoco dispara a bocajarro, así que un bot pegado al enemigo
 *  no tiene tiro. Acercarse "a secas" cuando no hay puesto de tiro lo mete justo
 *  ahí, y una vez pegado ya no hay hex que mejore nada — dos bots así se quedan
 *  cara a cara sin poder hacerse nada. */
function rangeBand(bot: BattleBot, fmap: Map<string, FunctionEntry>): { min: number; max: number } {
  let min = Infinity;
  let max = 0;
  for (const { entry } of attackEntries(bot, fmap)) {
    min = Math.min(min, Math.max(1, parseRangeMin(entry.range)));
    max = Math.max(max, parseRangeMax(entry.range));
  }
  return max === 0 ? { min: 1, max: 1 } : { min: Number.isFinite(min) ? min : 1, max };
}

/** Cuánto se sale una distancia de la banda de alcance (0 = dentro). */
function outOfBand(d: number, band: { min: number; max: number }): number {
  if (d < band.min) return band.min - d;
  if (d > band.max) return d - band.max;
  return 0;
}

/** Puntuación de un hex como posición del bot (N3).
 *
 *  `anyShot` dice si ALGUNO de los hexes alcanzables da tiro. Si ninguno lo da,
 *  el término de distancia deja de buscar el "puesto de tiro ideal" y pasa a
 *  meterse en la banda de alcance y, dentro de ella, acercarse: quedarse a
 *  distancia igual al alcance máximo sin poder disparar es como se queda un bot
 *  aparcado en una esquina toda la partida. */
function scoreHexPosition(ctx: RunHeuristicCtx, q: number, r: number, anyShot: boolean): number {
  const { state, bot, fmap } = ctx;
  const enemy = referenceEnemy(ctx);
  const range = Math.max(1, bestAttackRange(bot, fmap));
  const lifeRatio = bot.life / bot.maxLife;
  const threatWeight = lifeRatio < 0.35 ? 3 : 1;
  let score = 0;
  if (canShootFrom(ctx, q, r)) score += 4;
  if (enemy) {
    const d = hexDistance(q, r, enemy.q, enemy.r);
    // Acercarse hasta el alcance de ataque; con vida baja, alejarse
    const band = rangeBand(bot, fmap);
    const posPenalty = lifeRatio < 0.35
      ? -d                                              // huir: más lejos, mejor
      : anyShot
        ? Math.abs(d - range)                           // hay puesto de tiro: colocarse
        : outOfBand(d, band) * 2 + d * 0.2;             // sin tiro: entrar en banda, luego acercarse
    score -= posPenalty * 1.5;
    if (d <= range) score += bestExpectedDamage(bot, fmap);
    // Armas LR disparan solo en los 6 ejes: bonus por alinearse con el enemigo
    const hasLR = attackEntries(bot, fmap)
      .some(a => getAttackFn(a.fn.attackFunctionId)?.rangeKind === 'LR');
    if (hasLR) {
      const dq = q - enemy.q;
      const dr = r - enemy.r;
      if (dq === 0 || dr === 0 || dq + dr === 0) score += 1.5;
    }
  }
  score -= threatAt(state, bot, q, r, fmap) * 0.5 * threatWeight;
  // Corona de nodos relay hostiles
  for (const e of state.entities ?? []) {
    if (e.kind === 'relay_node' && e.life > 0 && hexDistance(q, r, e.q, e.r) === 1) score -= 2;
  }
  // No apelotonarse con aliados (splash enemigo, bloqueo de paso y LOS)
  score -= allyClusterPenalty(state, bot, q, r) * 0.8;
  score += objectiveBias(ctx.objectives, { kind: 'move', botId: bot.id, hex: { q, r } });
  return score;
}

/** Hex de destino para move().
 *  N1: aleatorio.
 *  N2: primero los hexes desde los que SÍ se puede disparar (el más lejano de
 *      ellos, que expone menos); si ninguno da tiro, acercarse de verdad.
 *  N3: scoring posicional (tiro, amenaza, retirada, corona de nodos, objetivo).
 *
 *  Los empates se rompen SIEMPRE por clave de hex. Sin ese desempate, dos hexes
 *  igual de buenos se alternaban según el orden de iteración del Set de
 *  opciones, que cambia al moverse el bot: el resultado era un ping-pong entre
 *  dos casillas, turno tras turno, sin acercarse jamás. */
export function chooseMoveHex(ctx: RunHeuristicCtx, options: string[]): string {
  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const enemy = referenceEnemy(ctx);
  if (!enemy) return pickRandom(options, ctx.rand);

  const scored = options.map(k => {
    const { q, r } = parseHex(k);
    return { k, q, r, shoots: canShootFrom(ctx, q, r), d: hexDistance(q, r, enemy.q, enemy.r) };
  });
  const anyShot = scored.some(s => s.shoots);

  if (ctx.level === 2) {
    const tiro = scored.filter(s => s.shoots);
    if (tiro.length > 0) {
      // Puede disparar: el puesto más lejano que conserve el tiro
      return [...tiro].sort((a, b) => b.d - a.d || a.k.localeCompare(b.k))[0].k;
    }
    // Ningún puesto de tiro a mano: meterse en la banda de alcance y, dentro de
    // ella, acercarse. Antes se minimizaba |dist − alcance máximo|, y con un
    // arma de alcance 8 eso dejaba al bot plantado a 7-8 hexes sin llegar nunca
    // a alinearse. Minimizar la distancia a secas es el error contrario: lo
    // pega al enemigo, por debajo del alcance mínimo, donde tampoco dispara.
    const band = rangeBand(ctx.bot, ctx.fmap);
    return [...scored].sort((a, b) =>
      outOfBand(a.d, band) - outOfBand(b.d, band) || a.d - b.d || a.k.localeCompare(b.k))[0].k;
  }

  const score = new Map(scored.map(s => [s.k, scoreHexPosition(ctx, s.q, s.r, anyShot)]));
  return [...scored]
    .sort((a, b) => score.get(b.k)! - score.get(a.k)! || a.k.localeCompare(b.k))[0].k;
}

/** Objetivo de ataque (clave de hex entre los resaltados).
 *  N1: aleatorio. N2: menor vida efectiva. N3: valor (kill > daño − sobrematar > amenaza). */
/**
 * Elección de punto de impacto para los ataques de área que pueden apuntar a
 * un Hex vacío (gravityWell, empField).
 *
 * Aquí `options` trae TODOS los hexes en rango, no solo los ocupados, así que
 * la heurística normal no sirve: hay que evaluar a cuántos Bots alcanza cada
 * punto. Un hex vacío entre dos enemigos suele valer más que impactar sobre
 * uno de ellos.
 */
function chooseSplashHex(ctx: RunHeuristicCtx, options: string[], radius: number): string {
  const { state, bot, fmap } = ctx;
  const fnId = ctx.runState.pendingFn?.attackFunctionId;
  const entry = fnId ? fmap.get(fnId) : undefined;
  const dmg = expectedDamage(entry?.damage);
  const focus = chooseFocusTarget(state, bot.playerId, fmap);

  /** Bots vivos dentro del área de un punto de impacto, sin contar al atacante. */
  const alcanzados = (q: number, r: number) =>
    state.bots.filter(b =>
      !b.destroyed && b.id !== bot.id && hexDistance(q, r, b.q, b.r) <= radius);

  let best = options[0];
  let bestScore = -Infinity;

  for (const k of options) {
    const { q, r } = parseHex(k);
    const dentro = alcanzados(q, r);
    if (dentro.length === 0) continue;

    const enemigos = dentro.filter(b => b.playerId !== bot.playerId);
    const aliados = dentro.filter(b => b.playerId === bot.playerId);

    // Nivel 1: le basta con acertar a alguien, sin cálculo fino.
    if (ctx.level === 1) {
      if (enemigos.length > 0) return k;
      continue;
    }

    let score = 0;
    for (const e of enemigos) {
      const eff = effectiveLife(e);
      score += Math.min(dmg, eff);              // daño aprovechable
      if (dmg >= eff) score += 100;             // remate
      if (ctx.level >= 3) {
        score += bestExpectedDamage(e, fmap) * 0.5;  // priorizar amenazas
        if (focus?.id === e.id) score += 3;          // foco de fuego del equipo
        score += objectiveBias(ctx.objectives, { kind: 'target', botId: bot.id, targetId: e.id });
      }
    }

    // El fuego amigo pesa, pero no es prohibitivo: a veces compensa.
    for (const a of aliados) {
      const eff = effectiveLife(a);
      score -= Math.min(dmg, eff) * 1.5;
      if (dmg >= eff) score -= 200;             // jamás rematar a un aliado
    }

    if (ctx.level >= 3) {
      // Valor propio de cada función más allá del daño bruto.
      if (fnId === 'empField') {
        // El DMZ escala con el número de afectados: cada enemigo tiene ~50%
        // de comerse el estado.
        score += enemigos.length * 2.5;
      } else if (fnId === 'gravityWell') {
        // Atraer agrupa al rival y lo acerca: interesa si con ello queda
        // pegado a nuestro Bot (más opciones de cuerpo a cuerpo).
        for (const e of enemigos) {
          const antes = hexDistance(bot.q, bot.r, e.q, e.r);
          const despues = Math.max(1, antes - 1);
          if (despues < antes) score += 1.5;
        }
        score += Math.max(0, enemigos.length - 1) * 2; // premia agrupar
      }
    }

    if (score > bestScore) { bestScore = score; best = k; }
  }

  // Ningún punto alcanza a nadie: no malgastar, pero hay que devolver algo.
  if (bestScore === -Infinity) {
    const conEnemigo = options.filter(k => {
      const { q, r } = parseHex(k);
      return alcanzados(q, r).some(b => b.playerId !== bot.playerId);
    });
    return conEnemigo.length > 0 ? pickRandom(conEnemigo, ctx.rand) : pickRandom(options, ctx.rand);
  }
  return best;
}

export function chooseTargetHex(ctx: RunHeuristicCtx, options: string[]): string {
  const pendingId = ctx.runState.pendingFn?.attackFunctionId;
  const pendingDef = pendingId ? getAttackFn(pendingId) : undefined;
  if (pendingDef?.canTargetEmptyHex && pendingDef.splashRadius) {
    return chooseSplashHex(ctx, options, pendingDef.splashRadius);
  }

  if (ctx.level === 1) return pickRandom(options, ctx.rand);
  const { state, bot, fmap } = ctx;
  const botAt = (k: string) => {
    const { q, r } = parseHex(k);
    return state.bots.find(b => !b.destroyed && b.q === q && b.r === r) ?? null;
  };
  const enemyOptions = options.filter(k => {
    const b = botAt(k);
    return b !== null && b.playerId !== bot.playerId;
  });
  if (enemyOptions.length === 0) {
    // Solo entidades (o aliados con canTargetAllies): revienta la de menos vida
    const entityAt = (k: string) => {
      const { q, r } = parseHex(k);
      return (state.entities ?? []).find(e => e.q === q && e.r === r) ?? null;
    };
    const entities = options.filter(k => entityAt(k) !== null);
    if (entities.length > 0) {
      return [...entities].sort((a, b) => (entityAt(a)!.life - entityAt(b)!.life))[0];
    }
    return pickRandom(options, ctx.rand);
  }

  const focus = chooseFocusTarget(state, bot.playerId, fmap);

  if (ctx.level === 2) {
    // Foco de fuego: si el objetivo del equipo está a tiro, va primero
    if (focus) {
      const focusKey = enemyOptions.find(k => botAt(k)!.id === focus.id);
      if (focusKey) return focusKey;
    }
    return [...enemyOptions].sort((a, b) => effectiveLife(botAt(a)!) - effectiveLife(botAt(b)!))[0];
  }

  const fn = ctx.runState.pendingFn;
  const entry = fn?.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const dmg = expectedDamage(entry?.damage);
  let best = enemyOptions[0];
  let bestScore = -Infinity;
  for (const k of enemyOptions) {
    const target = botAt(k)!;
    const eff = effectiveLife(target);
    const kill = dmg >= eff;
    const score = (kill ? 100 : 0)
      + Math.min(dmg, eff)                       // daño real aplicable (anti-sobrematar)
      + bestExpectedDamage(target, fmap) * 0.5   // priorizar amenazas
      + (focus?.id === target.id ? 3 : 0)        // foco de fuego del equipo
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
    // Reposicionamiento: mismo criterio que move (a alcance / kiting)
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
