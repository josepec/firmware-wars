import type {
  BattleBot,
  BattleState,
  CpuLevel,
  PlayerId,
} from '../../../../shared/types/battle.types';
import type { RunState } from '../simulator-run.utils';
import type { CriterionChoice, DeploySubPhase, InitSubPhase } from '../simulator-play.utils';

/** RNG inyectable: producción usa Math.random; los tests, uno sembrado. */
export type RandomFn = () => number;

/** Elige un elemento al azar de una lista no vacía. */
export function pickRandom<T>(items: readonly T[], rand: RandomFn): T {
  return items[Math.floor(rand() * items.length)];
}

/** Foto plana del estado observable del simulador. La construye el controlador
 *  leyendo las señales de SimulatorPlay; `detectPendingDecision` es pura sobre ella. */
export interface AiSnapshot {
  state: BattleState;
  /** events().length — token de idempotencia entre detección y ejecución. */
  seq: number;
  runState: RunState;
  subPhase: DeploySubPhase;
  initSubPhase: InitSubPhase;
  choiceP1: CriterionChoice | null;
  choiceP2: CriterionChoice | null;
  deployPptWinner: PlayerId | null;
  initPptWinner: PlayerId | null;
  deployStarter: PlayerId | null;
  initStarted: boolean;
  pendingRoll: string | null;
  rollingColor: boolean;
  rollingPpt: boolean;
  activeDeployer: PlayerId | null;
  nextBootBot: BattleBot | null;
  bootRollingFor: string | null;
  nextCompileBot: BattleBot | null;
  currentRunBot: BattleBot | null;
  interceptBot: BattleBot | null;
  /** Hexes seleccionables actuales (claves "q,r"), si el paso usa el mapa. */
  selectableHexes: string[] | null;
  peekRevealPlayer: PlayerId | null;
  chargedAnimating: boolean;
}

/** Owner 'shared' = confirmaciones sin dueño (PPT resultado, nueva ronda):
 *  la IA solo las ejecuta cuando no hay ningún jugador humano (cvc). */
export type DecisionOwner = PlayerId | 'shared';

export type PendingDecision =
  | { kind: 'criterion'; owner: PlayerId }
  | { kind: 'ppt-roll'; owner: PlayerId; context: 'deploy' | 'init' }
  | { kind: 'ppt-repeat'; owner: DecisionOwner; context: 'deploy' | 'init' }
  | { kind: 'ppt-confirm'; owner: DecisionOwner; context: 'deploy' | 'init' }
  | { kind: 'color-roll'; owner: PlayerId }
  | { kind: 'deploy-hex'; owner: PlayerId; options: string[] }
  | { kind: 'new-round'; owner: DecisionOwner }
  | { kind: 'boot'; owner: PlayerId; botId: string }
  | { kind: 'compile'; owner: PlayerId; botId: string }
  | { kind: 'resolve-op'; owner: PlayerId; botId: string }
  | { kind: 'pick-number'; owner: PlayerId; botId: string; options: number[] }
  | { kind: 'intercept-decide'; owner: PlayerId; interceptorId: string }
  | { kind: 'intercept-number'; owner: PlayerId; interceptorId: string; options: number[] }
  | { kind: 'move-hex'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'dash-hex'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'shadow-hex'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'barrier-hex'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'relay-hex'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'target'; owner: PlayerId; botId: string; options: string[] }
  | { kind: 'charged'; owner: PlayerId; botId: string }
  | { kind: 'peek-ack'; owner: PlayerId }
  | { kind: 'advance-op'; owner: PlayerId; botId: string }
  | { kind: 'debug-phase'; owner: PlayerId; botId: string }
  | { kind: 'finish-bot'; owner: PlayerId; botId: string };

/** Clave estable de una decisión: si tras el delay la clave cambió, se aborta. */
export function decisionKey(d: PendingDecision, seq: number): string {
  const botId = 'botId' in d ? d.botId : 'interceptorId' in d ? d.interceptorId : '';
  return `${d.kind}|${d.owner}|${botId}|${seq}`;
}

export function cpuLevelOf(state: BattleState, p: PlayerId): CpuLevel | null {
  const c = state.players[p]?.controller;
  return c?.kind === 'cpu' ? c.level : null;
}

export function hasHumanPlayer(state: BattleState): boolean {
  return ([1, 2] as PlayerId[]).some(p => cpuLevelOf(state, p) === null);
}
