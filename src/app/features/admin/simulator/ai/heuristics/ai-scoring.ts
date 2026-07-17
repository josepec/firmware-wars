import type { BattleBot, BattleState, FunctionCall } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { parseRangeMax } from '../../simulator-run.utils';
import { hexDistance } from '../../engine/pathfinding';

/** Daño esperado de una expresión de daño ("1d6", "2", "—", "*"). */
export function expectedDamage(s: string | undefined | null): number {
  if (!s || s === '—' || s === '*') return 0;
  const m = /^(\d+)d(\d+)$/.exec(s.trim());
  if (m) return parseInt(m[1], 10) * (parseInt(m[2], 10) + 1) / 2;
  const flat = parseInt(s.trim(), 10);
  return isNaN(flat) ? 0 : flat;
}

export function effectiveLife(bot: BattleBot): number {
  return bot.life + bot.shield;
}

export function parseHex(k: string): { q: number; r: number } {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export function livingEnemies(state: BattleState, bot: BattleBot): BattleBot[] {
  return state.bots.filter(b => b.playerId !== bot.playerId && !b.destroyed);
}

export function nearestEnemy(state: BattleState, bot: BattleBot): BattleBot | null {
  let best: BattleBot | null = null;
  let bestD = Infinity;
  for (const e of livingEnemies(state, bot)) {
    const d = hexDistance(bot.q, bot.r, e.q, e.r);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Funciones de ataque disponibles del bot (por versión), con su entrada de tabla. */
export function attackEntries(
  bot: BattleBot,
  fmap: Map<string, FunctionEntry>,
): Array<{ fn: FunctionCall; entry: FunctionEntry }> {
  const out: Array<{ fn: FunctionCall; entry: FunctionEntry }> = [];
  const add = (refs: ({ functionId: string } | null)[]) => {
    for (const ref of refs) {
      if (!ref) continue;
      const entry = fmap.get(ref.functionId);
      if (entry) out.push({ fn: { type: 'attack', attackFunctionId: ref.functionId }, entry });
    }
  };
  add(bot.attacks.v1);
  if (bot.version >= 2) add(bot.attacks.v2);
  if (bot.version >= 3 && bot.attacks.v3) add([bot.attacks.v3]);
  return out;
}

/** Mejor alcance de ataque del bot (0 si no tiene ataques usables). */
export function bestAttackRange(bot: BattleBot, fmap: Map<string, FunctionEntry>): number {
  return attackEntries(bot, fmap).reduce((m, a) => Math.max(m, parseRangeMax(a.entry.range)), 0);
}

/** Mejor daño esperado entre los ataques del bot. */
export function bestExpectedDamage(bot: BattleBot, fmap: Map<string, FunctionEntry>): number {
  return attackEntries(bot, fmap).reduce((m, a) => Math.max(m, expectedDamage(a.entry.damage)), 0);
}

/** Amenaza enemiga sobre un hex: suma del mejor daño esperado de cada enemigo
 *  que podría alcanzarlo el próximo turno (movimiento + alcance). */
export function threatAt(
  state: BattleState,
  bot: BattleBot,
  q: number,
  r: number,
  fmap: Map<string, FunctionEntry>,
): number {
  let sum = 0;
  for (const e of livingEnemies(state, bot)) {
    const reach = e.maxMovement + Math.max(1, bestAttackRange(e, fmap));
    if (hexDistance(e.q, e.r, q, r) <= reach) sum += bestExpectedDamage(e, fmap);
  }
  return sum;
}

/** Distribución exacta de la suma de k dados d6 → P(current + suma > max). */
export function overflowProbability(current: number, max: number, k: number): number {
  if (k === 0) return 0;
  let dist = new Map<number, number>([[0, 1]]);
  for (let i = 0; i < k; i++) {
    const next = new Map<number, number>();
    for (const [sum, p] of dist) {
      for (let face = 1; face <= 6; face++) {
        next.set(sum + face, (next.get(sum + face) ?? 0) + p / 6);
      }
    }
    dist = next;
  }
  let p = 0;
  for (const [sum, prob] of dist) {
    if (current + sum > max) p += prob;
  }
  return p;
}

/** Energía útil esperada al tirar k d6 (lo que sobrepasa maxEnergy se pierde). */
export function expectedUsefulEnergy(current: number, max: number, k: number): number {
  if (k === 0) return 0;
  let dist = new Map<number, number>([[0, 1]]);
  for (let i = 0; i < k; i++) {
    const next = new Map<number, number>();
    for (const [sum, p] of dist) {
      for (let face = 1; face <= 6; face++) {
        next.set(sum + face, (next.get(sum + face) ?? 0) + p / 6);
      }
    }
    dist = next;
  }
  let e = 0;
  for (const [sum, prob] of dist) {
    e += Math.min(current + sum, max) * prob;
  }
  return e - current;
}

/** "Flexibilidad" de un número de RAM para forzar condiciones futuras:
 *  los extremos (1, 6) fuerzan más comparadores → más valiosos de conservar. */
export function numberFlexValue(n: number): number {
  return Math.abs(n - 3.5);
}

/** Valor táctico de los EFECTOS SECUNDARIOS de cada ataque, en unidades de daño
 *  esperado equivalente. Complementa al daño puro al elegir ataque/plantilla.
 *  Cada valor está justificado por el efecto de attack-functions.json. */
const TACTICAL_BONUS: Record<string, number> = {
  powerSmash: 0.5,      // Empuja 1 hex: recoloca al rival (fuera de alcance, hacia coronas)
  laserBeam: 0.3,       // LR hasta 8: amenaza donde otros no llegan
  dashStrike: 1,        // Move gratis tras atacar → golpea y se recoloca (kiting)
  pulseShot: 0.5,       // +1 daño a rango 1 (aprox. al alza del caso melee)
  stabilizerHit: 1,     // LAG con P≈0.5: −1 movimiento rival un turno
  traceShot: 0.5,       // SLDV: dispara sin línea de visión, ignora coberturas
  ghostProtocol: 1.5,   // Roba un number: le quita una condición o un intercept
  peekMemory: 1.5,      // Información: habilita intercepts con bloqueo exacto
  plasmaBolt: -0.3,     // 1/6 de perder 2⚡ por sobrecalentamiento
  chainLightning: 1,    // Splash R(2): daño extra a secundarios agrupados
  gravityWell: 1.5,     // Splash R(2) + arrastra al centro: daño múltiple y desposiciona
  swapProtocol: 0.5,    // Intercambio de posición a rango 5: escape/asalto
  ionCannon: 0.3,       // LR hasta 8
  railgun: 0.8,         // Atraviesa objetivos en línea (daño a múltiples)
  chargedStrike: 0.5,   // EV alto con política de parada correcta
  dataSpike: 2,         // +1 BUG al objetivo: le roba un slot y 2⚡ de limpieza
  flashSpin: 1,         // Golpea todo R(1) alrededor: multiobjetivo si está rodeado
  syncBlast: 0.3,       // +1 daño con energía > 10
  novaBlast: -2,        // +1 BUG PROPIO por retroceso: caro (slot + limpieza)
  empField: 2,          // Splash R(1) + DMZ (P≈0.5): bloquea los ataques del rival un turno
  overdriveStrike: -0.5, // Gasta TODA la energía: deja el resto del turno seco
};

/** Bonus táctico del ataque (0 si no tiene efectos secundarios relevantes). */
export function attackTacticalBonus(fnId: string | undefined | null): number {
  if (!fnId) return 0;
  return TACTICAL_BONUS[fnId.replace(/\(\s*\)$/, '')] ?? 0;
}
