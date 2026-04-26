import type { BotVariableDefinition, PointDefinition } from '../../../core/services/data';

export interface BotPoint {
  constant: string;
  type: 'mejora' | 'desventaja' | null;
}

export interface BotStats {
  maxLife: number;
  maxEnergy: number;
  maxShield: number;
  maxMovement: number;
  maxNumbers: number;
  maxOperations: number;
}

export function buildBaseStats(variables: BotVariableDefinition[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of variables) {
    if (!v.variable.startsWith('MAX_')) continue;
    const n = parseInt(v.initialValue, 10);
    if (!Number.isNaN(n)) out[v.variable] = n;
  }
  return out;
}

function applyDelta(base: number, modifier: string | undefined): number {
  if (!modifier) return base;
  const n = parseInt(modifier, 10);
  return Number.isNaN(n) ? base : base + n;
}

export function computeBotStats(
  baseStats: Record<string, number>,
  points: PointDefinition[],
  botPoints: BotPoint[],
  version: 1 | 2 | 3 = 1,
): BotStats {
  const get = (constant: string): number => {
    const base = baseStats[constant] ?? 0;
    const allocated = botPoints.find(p => p.constant === constant);
    if (!allocated?.type) return base;
    const def = points.find(p => p.constant === constant);
    if (!def) return base;
    return applyDelta(base, allocated.type === 'mejora' ? def.mejora : def.desventaja);
  };

  const maxNumbersByVersion: Record<1 | 2 | 3, number> = { 1: 5, 2: 7, 3: 8 };

  return {
    maxLife: get('MAX_LIFE'),
    maxEnergy: get('MAX_ENERGY'),
    maxShield: get('MAX_SHIELD'),
    maxMovement: get('MAX_MOVEMENT'),
    maxNumbers: maxNumbersByVersion[version] ?? baseStats['MAX_NUMBERS'] ?? 5,
    maxOperations: baseStats['MAX_OPERATIONS'] ?? 3,
  };
}
