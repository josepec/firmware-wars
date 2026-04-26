import {
  hexKey,
  type BattleBot,
  type FunctionCall,
  type OperationKind,
  type PlayerId,
} from '../../../shared/types/battle.types';
import type { HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import { attackableHexes, hexDistance, lineOfSight } from './engine/pathfinding';
import type { OperationFace } from './engine/dice';
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
  | 'between-iters'
  | 'op-done'
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
  condResult: boolean | null;
  interceptBotId: string | null;
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
};

export function parseRange(s: string | undefined | null): number {
  if (!s) return 1;
  const m = /^\s*(\d+)/.exec(s);
  return m ? parseInt(m[1], 10) : 1;
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

export function fnEnergyCost(fn: FunctionCall, fmap: Map<string, FunctionEntry>): number {
  if (fn.type === 'move') return fn.moveDistance ?? 0;
  if (fn.type === 'shield') return 2;
  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  return parseEnergy(entry?.energy);
}

export function computeAttackTargets(
  bot: BattleBot,
  fn: FunctionCall,
  bots: BattleBot[],
  map: HexMapData,
  fmap: Map<string, FunctionEntry>,
): Set<string> {
  if (fn.type !== 'attack') return new Set();
  const entry = fn.attackFunctionId ? fmap.get(fn.attackFunctionId) : undefined;
  const range = parseRange(entry?.range);
  const reachable = attackableHexes(bot.q, bot.r, range, map, bots);
  const out = new Set<string>();
  for (const enemy of bots) {
    if (enemy.destroyed || enemy.playerId === bot.playerId) continue;
    const k = hexKey(enemy.q, enemy.r);
    if (reachable.has(k)) out.add(k);
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
