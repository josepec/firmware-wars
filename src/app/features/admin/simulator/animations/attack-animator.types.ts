export interface AttackAnimCtx {
  g: SVGGElement;
  attackId: string;
  attackerPx: { x: number; y: number };
  targetPx: { x: number; y: number } | null;
  secondaryPx: { x: number; y: number }[];
  damage: number;
  size: number;
  statusApplied?: string;
  statusRoll?: number;
  statusResisted?: boolean;
  pushMovePx?: { x: number; y: number };
  healAmount?: number;
  shieldConsumed?: number;
  energyCost?: number;
  missed?: boolean;
}
