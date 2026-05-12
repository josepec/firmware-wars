import { type AttackAnimCtx } from './attack-animator.types';
import { floatingText } from './primitives/floating-text';
import { impact } from './primitives/impact';
import { projectile } from './primitives/projectile';
import { drawLine } from './primitives/line';
import { selfAura } from './primitives/self-aura';
import { aoeRing } from './primitives/aoe-ring';
import { pushArrow } from './primitives/push-arrow';
import { statusGlitch } from './primitives/status-glitch';

const RED = '#ef4444';

// Pixel offset from (q,r)=0 to neighbor (dq,dr) for flat-top hexagons
function dirPx(dq: number, dr: number, size: number): { x: number; y: number } {
  return { x: size * 1.5 * dq, y: size * (Math.sqrt(3) / 2 * dq + Math.sqrt(3) * dr) };
}

type Recipe = (ctx: AttackAnimCtx) => Promise<void>;

const RECIPES: Partial<Record<string, Recipe>> = {
  // ── V1 ──────────────────────────────────────────────────────────────────
  laserBeam: async ctx => {
    if (!ctx.targetPx) return;
    await Promise.all([
      drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#22d3ee', 1.5, 270),
      impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#22d3ee', ctx.size),
    ]);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  rocketPunch: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#f97316', 5, 400);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#f97316', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  pinpointBurst: async ctx => {
    if (!ctx.targetPx) return;
    await drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#f8fafc', 1, 180);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  pulseShot: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#a78bfa', 4, 555);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#a78bfa', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  stabilizerHit: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#94a3b8', 3.5, 450);
    if (ctx.statusApplied === 'LAG') {
      statusGlitch(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'LAG', ctx.size);
      floatingText(ctx.g, ctx.targetPx.x + ctx.size * 0.35, ctx.targetPx.y - ctx.size * 0.5, 'LAG!', '#f97316', ctx.size);
    } else if (ctx.statusResisted) {
      floatingText(ctx.g, ctx.targetPx.x + ctx.size * 0.2, ctx.targetPx.y - ctx.size * 0.5, 'RESIST', '#22c55e', ctx.size);
    }
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  powerSmash: async ctx => {
    if (!ctx.targetPx) return;
    await impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, RED, ctx.size * 1.2);
    if (ctx.pushMovePx) pushArrow(ctx.g, ctx.targetPx, ctx.pushMovePx, RED, ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  dashStrike: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#f97316', 4, 300);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#f97316', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  // ── V2 ──────────────────────────────────────────────────────────────────
  nanoRepair: async ctx => {
    if ((ctx.healAmount ?? 0) > 0) {
      floatingText(ctx.g, ctx.attackerPx.x + ctx.size * 0.3, ctx.attackerPx.y, `+${ctx.healAmount}♥`, RED, ctx.size);
    }
    await selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, RED, 'buff', ctx.size);
  },

  traceShot: async ctx => {
    if (!ctx.targetPx) return;
    await drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#38bdf8', 1.5, 300);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  plasmaBolt: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#84cc16', 4, 465);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#84cc16', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  firewall: async ctx => {
    await selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#3b82f6', 'shield', ctx.size);
    floatingText(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, 'SAFE', '#3b82f6', ctx.size);
  },

  ionCannon: async ctx => {
    if (!ctx.targetPx) return;
    await Promise.all([
      drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#e0f2fe', 4, 120),
      impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#e0f2fe', ctx.size * 1.1),
    ]);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  shadowStep: async ctx => {
    if (!ctx.targetPx) return;
    selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#7c3aed', 'fade', ctx.size);
    await impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#7c3aed', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  swapProtocol: async ctx => {
    if (!ctx.targetPx) return;
    await Promise.all([
      impact(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#22d3ee', ctx.size * 0.85),
      impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#e879f9', ctx.size * 0.85),
    ]);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'SWAP', '#e2e8f0', ctx.size);
  },

  overclockStrike: async ctx => {
    if (!ctx.targetPx) return;
    selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#facc15', 'buff', ctx.size);
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#facc15', 4.5, 435);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#facc15', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  berserkProtocol: async ctx => {
    if (!ctx.targetPx) return;
    selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#dc2626', 'rage', ctx.size);
    await impact(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#dc2626', ctx.size * 0.9);
    await impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#dc2626', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  chainLightning: async ctx => {
    if (!ctx.targetPx) return;
    const chain = [ctx.targetPx, ...ctx.secondaryPx];
    let prev = ctx.attackerPx;
    for (const next of chain) {
      await drawLine(ctx.g, prev.x, prev.y, next.x, next.y, '#fbbf24', 2, 195);
      impact(ctx.g, next.x, next.y, '#fbbf24', ctx.size * 0.75);
      prev = next;
    }
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  gravityWell: async ctx => {
    if (!ctx.targetPx) return;
    await aoeRing(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#7c3aed', ctx.size * 1.8, true);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  ghostProtocol: async ctx => {
    if (!ctx.targetPx) return;
    statusGlitch(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'ERASE', ctx.size);
    await floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'ERASE', '#64748b', ctx.size);
  },

  deployBarrier: async ctx => {
    await aoeRing(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#4b5563', ctx.size * 0.85);
  },

  // ── V3 ──────────────────────────────────────────────────────────────────
  overdriveStrike: async ctx => {
    if (!ctx.targetPx) return;
    selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#f59e0b', 'charge', ctx.size);
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#f59e0b', 5.5, 450);
    impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#f59e0b', ctx.size * 1.1);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  dataSpike: async ctx => {
    if (!ctx.targetPx) return;
    await projectile(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#10b981', 3.5, 450);
    statusGlitch(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'BUG', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x + ctx.size * 0.35, ctx.targetPx.y - ctx.size * 0.5, '+🐛', '#f97316', ctx.size);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  syncBlast: async ctx => {
    if (!ctx.targetPx) return;
    await Promise.all([
      aoeRing(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#06b6d4', ctx.size * 1.2),
      impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#06b6d4', ctx.size),
    ]);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  novaBlast: async ctx => {
    if (!ctx.targetPx) return;
    await Promise.all([
      impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#fbbf24', ctx.size * 1.4),
      impact(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, RED, ctx.size * 0.9),
    ]);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
    floatingText(ctx.g, ctx.attackerPx.x + ctx.size * 0.35, ctx.attackerPx.y - ctx.size * 0.5, '+🐛', '#f97316', ctx.size);
  },

  flashSpin: async ctx => {
    const s = ctx.size;
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
    await Promise.all(dirs.map(([dq, dr]) => {
      const d = dirPx(dq, dr, s);
      return drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y,
        ctx.attackerPx.x + d.x, ctx.attackerPx.y + d.y, '#e2e8f0', 1.5, 270);
    }));
    if (ctx.targetPx && ctx.damage > 0) {
      floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
    }
  },

  empField: async ctx => {
    if (!ctx.targetPx) return;
    await aoeRing(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#0ea5e9', ctx.size * 1.5);
    for (const p of [ctx.targetPx, ...ctx.secondaryPx]) {
      statusGlitch(ctx.g, p.x, p.y, 'DMZ', ctx.size);
    }
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  chargedStrike: async ctx => {
    if (!ctx.targetPx) return;
    selfAura(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#f59e0b', 'charge', ctx.size);
    await impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, '#dc2626', ctx.size * 1.15);
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  railgun: async ctx => {
    if (!ctx.targetPx) return;
    await drawLine(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, ctx.targetPx.x, ctx.targetPx.y, '#f8fafc', 3, 105);
    for (const p of [ctx.targetPx, ...ctx.secondaryPx]) {
      impact(ctx.g, p.x, p.y, '#f8fafc', ctx.size * 0.85);
    }
    floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  },

  relayNode: async ctx => {
    await aoeRing(ctx.g, ctx.attackerPx.x, ctx.attackerPx.y, '#22d3ee', ctx.size * 0.85);
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

export async function playAttackAnim(ctx: AttackAnimCtx): Promise<void> {
  if (ctx.missed) {
    if (ctx.targetPx) floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, 'MISS', '#6b7280', ctx.size);
    await new Promise(r => setTimeout(r, 400));
    return;
  }
  // DB stores IDs as "name()" — strip trailing () for recipe lookup
  const normalizedId = ctx.attackId.replace(/\(\s*\)$/, '');
  const recipe = RECIPES[normalizedId];
  if (recipe) {
    await recipe(ctx);
  } else if (ctx.targetPx) {
    await impact(ctx.g, ctx.targetPx.x, ctx.targetPx.y, RED, ctx.size);
    if (ctx.damage > 0) floatingText(ctx.g, ctx.targetPx.x, ctx.targetPx.y, `-${ctx.damage}♥`, RED, ctx.size);
  }
  // Stat supplementary texts — fire-and-forget after hit lands
  // Shield offset right+down so it doesn't overlap with the damage text (which is at targetPx center)
  if ((ctx.shieldConsumed ?? 0) > 0 && ctx.targetPx) {
    floatingText(ctx.g, ctx.targetPx.x + ctx.size * 0.55, ctx.targetPx.y + ctx.size * 0.3, `-${ctx.shieldConsumed}🛡`, '#60a5fa', ctx.size);
  }
  if ((ctx.energyCost ?? 0) > 0) {
    floatingText(ctx.g, ctx.attackerPx.x - ctx.size * 0.3, ctx.attackerPx.y + ctx.size * 0.15, `-${ctx.energyCost}⚡`, '#fbbf24', ctx.size);
  }
}

export async function playOverloadAnim(
  g: SVGGElement, cx: number, cy: number, lifeLoss: number, size: number,
): Promise<void> {
  impact(g, cx, cy, '#f97316', size * 0.9);
  await floatingText(g, cx, cy, `OVL -${lifeLoss}♥`, '#f97316', size);
}

/** Shield action: pulsing ring + stat texts */
export function playShieldAnim(
  g: SVGGElement, cx: number, cy: number, amount: number, energyCost: number, size: number,
): void {
  selfAura(g, cx, cy, '#60a5fa', 'shield', size);
  if (amount > 0) floatingText(g, cx - size * 0.25, cy, `+${amount}🛡`, '#60a5fa', size);
  if (energyCost > 0) floatingText(g, cx + size * 0.45, cy + size * 0.2, `-${energyCost}⚡`, '#fbbf24', size);
}

/** Move energy cost text at origin hex */
export function playMoveEnergyAnim(
  g: SVGGElement, cx: number, cy: number, energyCost: number, size: number,
): void {
  if (energyCost > 0) floatingText(g, cx, cy, `-${energyCost}⚡`, '#fbbf24', size);
}
