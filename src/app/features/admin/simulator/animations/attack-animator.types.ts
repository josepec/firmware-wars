export interface AttackAnimCtx {
  g: SVGGElement;
  attackId: string;
  attackerPx: { x: number; y: number };
  targetPx: { x: number; y: number } | null;
  secondaryPx: { x: number; y: number; damage?: number; shieldConsumed?: number }[];
  damage: number;
  size: number;
  statusApplied?: string;
  statusRoll?: number;
  statusResisted?: boolean;
  /** Tirada de estado resuelta por Bot — para efectos que afectan a varios a la vez
   *  (empField): permite marcar sólo a quien no supera la tirada. */
  statusHits?: { x: number; y: number; applied: boolean; kind: string }[];
  pushMovePx?: { x: number; y: number };
  healAmount?: number;
  shieldConsumed?: number;
  energyCost?: number;
  missed?: boolean;
  targetBugBlocked?: boolean;
  attackerBugBlocked?: boolean;
  skipEnergyAnim?: boolean;
}
