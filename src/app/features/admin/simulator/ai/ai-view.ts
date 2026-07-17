import type {
  BattleBot,
  BattleEvent,
  BattleState,
  CompiledProgram,
  PlayerId,
} from '../../../../shared/types/battle.types';
import type { RunState } from '../simulator-run.utils';
import type { CriterionChoice, DeploySubPhase, InitSubPhase } from '../simulator-play.utils';
import type { FunctionEntry } from '../simulator-bot-card';
import type { AiSnapshot } from './ai.types';

/** Lecturas que el controlador necesita de SimulatorPlay. El componente las
 *  cumple estructuralmente (señales/computeds/métodos ya existentes) → se pasa `this`. */
export interface AiView {
  currentState(): BattleState;
  events(): BattleEvent[];
  runState(): RunState;
  subPhase(): DeploySubPhase;
  initSubPhase(): InitSubPhase;
  choiceP1(): CriterionChoice | null;
  choiceP2(): CriterionChoice | null;
  deployPptWinner(): PlayerId | null;
  initPptWinner(): PlayerId | null;
  deployStarter(): PlayerId | null;
  initStarted(): boolean;
  pendingRoll(): string | null;
  rollingColor(): boolean;
  rollingPpt(): PlayerId | null;
  rollingInitPpt(): PlayerId | null;
  activeDeployer(): PlayerId | null;
  nextBootBot(): BattleBot | null;
  bootRollingFor(): string | null;
  nextCompileBot(): BattleBot | null;
  currentRunBot(): BattleBot | null;
  getInterceptBot(): BattleBot | null;
  selectableHexes(): ReadonlySet<string> | null;
  peekMemoryReveal(): { playerId: PlayerId } | null;
  chargedStrikeAnim(): { rolling: boolean } | null;
  pendingSaves(): number;
  animatingPlayers(): ReadonlySet<PlayerId>;
  saveError(): string | null;
  functionsMap(): Map<string, FunctionEntry>;
}

/** Acciones de decisión de SimulatorPlay que la IA invoca — las mismas que un humano. */
export interface AiActions {
  onCriterionPick(player: PlayerId, choice: CriterionChoice): void;
  rollPpt(player: PlayerId): Promise<void>;
  repeatPpt(): void;
  confirmDeployResult(): Promise<void>;
  rollInitPpt(player: PlayerId): Promise<void>;
  repeatInitPpt(): void;
  confirmInitResult(): Promise<void>;
  startNewRound(): void;
  rollColorDice(): void;
  onHexClick(coord: { q: number; r: number }): Promise<void>;
  bootRollFor(botId: string, chosen: 0 | 1 | 2 | 3): Promise<void>;
  onCompileCommit(botId: string, program: CompiledProgram): Promise<void>;
  resolveCurrentOp(): Promise<void>;
  pickNumber(n: number): Promise<void>;
  beginIntercept(): void;
  pickInterceptNumber(n: number): Promise<void>;
  skipIntercept(): Promise<void>;
  pickRunHex(q: number, r: number): Promise<void>;
  pickRunTarget(targetId: string): Promise<void>;
  pickEntityTarget(entityId: string): Promise<void>;
  pickDashMoveHex(q: number, r: number): Promise<void>;
  pickShadowStepHex(q: number, r: number): Promise<void>;
  pickDeployBarrierHex(q: number, r: number): Promise<void>;
  pickRelayNodeHex(q: number, r: number): Promise<void>;
  chargedRollMore(): Promise<void>;
  chargedStop(): Promise<void>;
  acknowledgePeek(): Promise<void>;
  advanceOp(): Promise<void>;
  applyDebugFn(action: { action: string; n?: number }): Promise<void>;
  finishBotRun(): Promise<void>;
}

/** Construye la foto plana que consume `detectPendingDecision`. */
export function buildSnapshot(view: AiView): AiSnapshot {
  const hexes = view.selectableHexes();
  return {
    state: view.currentState(),
    seq: view.events().length,
    runState: view.runState(),
    subPhase: view.subPhase(),
    initSubPhase: view.initSubPhase(),
    choiceP1: view.choiceP1(),
    choiceP2: view.choiceP2(),
    deployPptWinner: view.deployPptWinner(),
    initPptWinner: view.initPptWinner(),
    deployStarter: view.deployStarter(),
    initStarted: view.initStarted(),
    pendingRoll: view.pendingRoll(),
    rollingColor: view.rollingColor(),
    rollingPpt: view.rollingPpt() !== null || view.rollingInitPpt() !== null,
    activeDeployer: view.activeDeployer(),
    nextBootBot: view.nextBootBot(),
    bootRollingFor: view.bootRollingFor(),
    nextCompileBot: view.nextCompileBot(),
    currentRunBot: view.currentRunBot(),
    interceptBot: view.getInterceptBot(),
    selectableHexes: hexes ? [...hexes] : null,
    peekRevealPlayer: view.peekMemoryReveal()?.playerId ?? null,
    chargedAnimating: view.chargedStrikeAnim()?.rolling === true,
  };
}
