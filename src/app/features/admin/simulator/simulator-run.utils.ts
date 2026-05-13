import {
  hexKey,
  type BattleBot,
  type FunctionCall,
  type MapEntity,
  type OperationKind,
  type PlayerId,
  type StatusEffectKind,
} from '../../../shared/types/battle.types';
import type { HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import { attackableHexes, hexDistance, lineOfSight } from './engine/pathfinding';
import type { OperationFace } from './engine/dice';
import { getAttackFn, lrHexes, sldvHexes } from './attack-fns/index';
import type { FunctionEntry } from './simulator-bot-card';

export type RunStep =
  | 'idle'
  | 'rolling'
  | 'intercept-prompt'
  | 'intercept-picking'
  | 'picking-number'
  | 'evaluated'
  | 'picking-hex'
  | 'picking-target'
  | 'charged-rolling'
  | 'dash-move'
  | 'shadow-step'
  | 'deploy-barrier'
  | 'between-iters'
  | 'op-done'
  | 'debug'
  | 'bot-done';

export interface RunState {
  botId: string | null;
  opIdx: number;
  step: RunStep;
  opFace: OperationFace | null;
  d6: number | null;
  pickedNumber: number | null;
  branch: 'primary' | 'secondary' | null;
  forRemaining: number;
  pendingFn: FunctionCall | null;
  condResult: boolean | number | null;
  interceptBotId: string | null;
  /** Bots that were offered intercept this op and declined — excluded from further offers this op. */
  interceptDeclinedIds: string[];
  loopExecuted: boolean;
  chargedAccum: number;
  chargedTargetId: string | null;
  lastOpNotice: string | null;
}

export const initialRunState: RunState = {
  botId: null,
  opIdx: 0,
  step: 'idle',
  opFace: null,
  d6: null,
  pickedNumber: null,
  branch: null,
  forRemaining: 0,
  pendingFn: null,
  condResult: null,
  interceptBotId: null,
  interceptDeclinedIds: [],
  loopExecuted: false,
  chargedAccum: 0,
  chargedTargetId: null,
  lastOpNotice: null,
};

export function hasStatus(bot: BattleBot, kind: StatusEffectKind): boolean {
  return (bot.statusEffects ?? []).some(s => s.kind === kind);
}

export function parseRange(s: string | undefined | null): number {
  return parseRangeMax(s);
}

export function parseRangeMin(s: string | undefined | null): number {
  if (!s || s.trim() === '—') return 0;
  const m = /^\s*(\d+)/.exec(s);
  return m ? parseInt(m[1], 10) : 1;
}

export function parseRangeMax(s: string | undefined | null): number {
  if (!s || s.trim() === '—') return 0;
  const beforeParens = s.split('(')[0];
  const nums = beforeParens.match(/\d+/g);
  if (!nums) return 1;
  return parseInt(nums[nums.length - 1], 10);
}

export function parseEnergy(s: string | undefined | null): number {
  if (!s) return 0;
  const m = /^\s*(\d+)/.exec(s);
  return m ? parseInt(m[1], 10) : 0;
}

export function parseDamage(s: string | undefined | null): number {
  if (!s) return 0;
  const m = /^\s*(\d+)/.exec(s);
  return m ? parseInt(m[1], 10) : 0;
}

export function fnEnergyCost(fn: FunctionCall, fmap: Map<string, FunctionEntry>, bot?: BattleBot): number {
  if (fn.type === 'move') return bot?.maxMovement ?? 0;
  if (fn.type === 'shield') return 2;
  const attackFnDef = fn.attackFunctionId ? getAttackFn(fn.attackFunctionId) : undefined;
  if (attackFnDef?.computeEnergyCost && bot) return attackFnDef.computeEnergyCost(bot);
  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  return parseEnergy(entry?.energy);
}

export function computeAttackTargets(
  bot: BattleBot,
  fn: FunctionCall,
  bots: BattleBot[],
  map: HexMapData,
  fmap: Map<string, FunctionEntry>,
  entities?: MapEntity[],
): Set<string> {
  if (fn.type !== 'attack') return new Set();
  const attackFnDef = fn.attackFunctionId ? getAttackFn(fn.attackFunctionId) : undefined;

  // Self-targeted: only the attacker's hex
  if (attackFnDef?.rangeKind === 'self') return new Set([hexKey(bot.q, bot.r)]);

  // Custom targeting override
  if (attackFnDef?.computeValidHexes) {
    const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
    return attackFnDef.computeValidHexes({
      attacker: bot, bots, map,
      rangeMin: parseRangeMin(entry?.range),
      rangeMax: parseRangeMax(entry?.range),
    });
  }

  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const rangeMin = parseRangeMin(entry?.range);
  const rangeMax = parseRangeMax(entry?.range);
  const rangeKind = attackFnDef?.rangeKind ?? 'normal';

  let reachable: Set<string>;
  if (rangeKind === 'SLDV') {
    reachable = sldvHexes(bot.q, bot.r, rangeMin, rangeMax, map);
  } else if (rangeKind === 'LR') {
    reachable = lrHexes(bot.q, bot.r, rangeMin, rangeMax, map, bots);
  } else {
    // normal and splash: LOS-based targeting to enemy hexes within range
    reachable = attackableHexes(bot.q, bot.r, rangeMax, map, bots);
    if (rangeMin > 1) {
      for (const k of [...reachable]) {
        const h = k.split(',').map(Number);
        if (hexDistance(bot.q, bot.r, h[0], h[1]) < rangeMin) reachable.delete(k);
      }
    }
  }

  const out = new Set<string>();
  for (const candidate of bots) {
    if (candidate.destroyed) continue;
    if (!attackFnDef?.canTargetAllies && candidate.playerId === bot.playerId) continue;
    if (candidate.id === bot.id) continue;
    const k = hexKey(candidate.q, candidate.r);
    if (reachable.has(k)) out.add(k);
  }
  if (!attackFnDef?.noEntityTarget) {
    for (const entity of (entities ?? [])) {
      if (entity.kind !== 'barrier') continue;
      const k = hexKey(entity.q, entity.r);
      if (reachable.has(k)) out.add(k);
    }
  }
  return out;
}

export function findClosestEnemyOf(
  fromQ: number,
  fromR: number,
  ownerId: PlayerId,
  bots: BattleBot[],
): BattleBot | null {
  let best: BattleBot | null = null;
  let bestD = Infinity;
  for (const b of bots) {
    if (b.destroyed || b.playerId === ownerId) continue;
    const d = hexDistance(fromQ, fromR, b.q, b.r);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function isWithinAttackReach(
  bot: BattleBot,
  target: BattleBot,
  fn: FunctionCall,
  bots: BattleBot[],
  map: HexMapData,
  fmap: Map<string, FunctionEntry>,
): boolean {
  if (fn.type !== 'attack') return false;
  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const range = parseRange(entry?.range);
  const d = hexDistance(bot.q, bot.r, target.q, target.r);
  if (d === 0 || d > range) return false;
  return lineOfSight(bot.q, bot.r, target.q, target.r, map, bots);
}

export const COMP_LABEL: Record<string, string> = {
  '<': '<',
  '<=': '≤',
  '>=': '≥',
  '>': '>',
  '!=': '≠',
  '==': '=',
};

export function opNeedsCondition(kind: OperationKind): boolean {
  return kind === 'IF' || kind === 'IF_ELSE' || kind === 'WHILE';
}
