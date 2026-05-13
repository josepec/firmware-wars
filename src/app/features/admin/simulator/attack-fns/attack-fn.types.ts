import type { BattleBot, BattleEvent, MapEntity } from '../../../../shared/types/battle.types';
import type { HexMapData } from '../../../../shared/components/hex-map/hex-map.types';

/** Tipos de rango definidos por el manual.
 *  - normal: distancia + LOS (por defecto)
 *  - LR: línea recta — el ataque va directo, se interrumpe por obstáculos en la trayectoria
 *  - SLDV: sin línea de visión — solo distancia, ignora obstáculos para apuntar
 *  - splash: R(n) — área de efecto de radio n desde el punto de impacto
 */
export type RangeKind = 'normal' | 'LR' | 'SLDV' | 'splash' | 'self';

export interface AttackTargetingContext {
  attacker: BattleBot;
  bots: BattleBot[];
  map: HexMapData;
  rangeMin: number;
  rangeMax: number;
}

export interface AttackResolveContext extends AttackTargetingContext {
  target: BattleBot;
  damage: number;
  energyCost: number;
  turn: number;
  activation: number;
  timestamp: string;
  /** Roll a die with the given number of sides. Injected by the simulator. */
  rollD: (sides: number) => number;
  splashRadius?: number;
  /** Active map entities (barriers, relay nodes). Injected by the simulator. */
  entities?: MapEntity[];
}

export interface AttackFnDef {
  /** ID que coincide con la `Función` (sin paréntesis) en attack-functions.json. Ej: 'powerSmash'. */
  id: string;
  /** Tipo de rango. */
  rangeKind: RangeKind;
  /** Radio del splash si rangeKind === 'splash'. */
  splashRadius?: number;
  /**
   * Override opcional del coste de energía.
   * Útil para costes dinámicos como overdriveStrike (gasta toda la energía).
   */
  computeEnergyCost?: (bot: BattleBot) => number;
  /**
   * Override opcional del cálculo de hexes objetivo válidos.
   * Si no se define, se usa la lógica por defecto según rangeKind.
   */
  computeValidHexes?: (ctx: AttackTargetingContext) => Set<string>;
  /**
   * Override opcional del cálculo de daño base.
   * Útil para daños condicionales o variables (`*`, +1 si energía > 10, etc.).
   * Si no se define, se parsea de attack-functions.json (ej. `1d4`, `2`).
   */
  rollDamage?: (ctx: AttackResolveContext) => number;
  /**
   * Hook opcional que se ejecuta tras aplicar el daño base — emite eventos
   * adicionales para efectos secundarios (push, status, healing, splash, etc.).
   */
  onHit?: (ctx: AttackResolveContext) => BattleEvent[];
  /** If true, after a hit the attacker may move 1 hex for free — player chooses the destination. */
  freeMove?: boolean;
  /** If true, allied bots are also valid targets (e.g. swapProtocol). */
  canTargetAllies?: boolean;
}
