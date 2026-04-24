import {
  DOT_COLORS,
  type DotColor,
} from '../../../shared/components/hex-map/hex-map.types';
import {
  hexKey,
  type BattleBot,
  type BattleState,
  type PlayerId,
} from '../../../shared/types/battle.types';
import { hexDistance } from './engine/pathfinding';

export const API_URL = 'https://firmware-wars-api.josepec.eu';
export const DEPLOY_PERIMETER = 6;
export const ANIM_MS = 900;
export const ANIM_KEY = 'simulator-dice-anim';

export type CriterionChoice = 'junior-1' | 'junior-2' | 'ppt';
export type PptHand = 'r' | 'p' | 's';
export type DeploySubPhase = 'criterion' | 'ppt-p1' | 'ppt-p2' | 'ppt-result' | 'done';
export type InitSubPhase = 'idle' | 'ppt-p1' | 'ppt-p2' | 'ppt-result' | 'done';
export type PptContext = 'deploy' | 'init';

export const COLOR_HEX: Record<DotColor, string> = Object.fromEntries(
  DOT_COLORS.map(c => [c.id, c.hex]),
) as Record<DotColor, string>;

export function rollPptDie(): PptHand {
  const faces: PptHand[] = ['r', 'p', 's'];
  return faces[Math.floor(Math.random() * faces.length)];
}

export function resolvePpt(a: PptHand, b: PptHand): PlayerId | null {
  if (a === b) return null;
  const beats: Record<PptHand, PptHand> = { r: 's', s: 'p', p: 'r' };
  return beats[a] === b ? 1 : 2;
}

export function pptLabel(h: PptHand | null | undefined): string {
  if (!h) return '—';
  return h === 'r' ? 'Piedra' : h === 'p' ? 'Papel' : 'Tijera';
}

export function pptEmoji(h: PptHand | null | undefined): string {
  if (!h) return '—';
  return h === 'r' ? '✊' : h === 'p' ? '✋' : '✌';
}

export function choiceLabel(c: CriterionChoice, p1Alias: string, p2Alias: string): string {
  if (c === 'junior-1') return `${p1Alias} es Junior`;
  if (c === 'junior-2') return `${p2Alias} es Junior`;
  return 'PPT';
}

export function computeValidDeployHexes(
  state: BattleState,
  color: DotColor,
  deployer: PlayerId,
): Set<string> {
  const enemies: BattleBot[] = state.bots.filter(
    b => b.playerId !== deployer && b.q !== -999 && !b.destroyed,
  );
  const occupied = new Set(
    state.bots.filter(b => b.q !== -999).map(b => hexKey(b.q, b.r)),
  );
  const typeMap = new Map(state.hexMap.hexTypes.map(t => [t.id, t]));
  const out = new Set<string>();
  for (const h of state.hexMap.hexes) {
    if (h.dot !== color) continue;
    const type = typeMap.get(h.typeId);
    if (type?.properties?.['traversable'] === 'false') continue;
    const k = hexKey(h.q, h.r);
    if (occupied.has(k)) continue;
    let ok = true;
    for (const e of enemies) {
      if (hexDistance(h.q, h.r, e.q, e.r) < DEPLOY_PERIMETER) { ok = false; break; }
    }
    if (ok) out.add(k);
  }
  return out;
}
