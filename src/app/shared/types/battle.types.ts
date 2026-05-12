import type { HexMapData } from '../components/hex-map/hex-map.types';

export type StatusEffectKind = 'LAG' | 'SAFE_MODE' | 'DMZ' | 'REBOOTING' | 'OVERCLOCK' | 'BERSERK';

export interface StatusEffect {
  kind: StatusEffectKind;
  appliedTurn: number;
}

export type TempBuffKind = never;

export interface TempBuff {
  kind: TempBuffKind;
  appliedTurn: number;
}

export interface MapEntity {
  id: string;
  kind: 'barrier' | 'relay_node';
  q: number;
  r: number;
  life: number;
  ownerId: string;
}

export type Phase =
  | 'deploy'
  | 'init'
  | 'boot'
  | 'compile'
  | 'run'
  | 'debug'
  | 'end'
  | 'finished';

export type OperationKind = 'IF' | 'IF_ELSE' | 'FOR' | 'WHILE' | 'TRY_CATCH';
export type Comparator = '<' | '<=' | '>=' | '>' | '!=' | '==';
export type FunctionType = 'move' | 'attack' | 'shield';
export type PlayerId = 1 | 2;

export interface AttackRef {
  functionId: string;
}

export interface BotAttackSlots {
  v1: (AttackRef | null)[];
  v2: (AttackRef | null)[];
  v3: AttackRef | null;
}

export interface FunctionCall {
  type: FunctionType;
  moveDistance?: number;
  attackFunctionId?: string;
}

export interface CompiledOperation {
  kind: OperationKind;
  primary: FunctionCall;
  secondary?: FunctionCall;
  forCount?: number;
}

export interface CompiledProgram {
  operations: CompiledOperation[];
}

export interface BattleBot {
  id: string;
  playerId: PlayerId;
  name: string;
  q: number;
  r: number;
  life: number;
  maxLife: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  maxShield: number;
  maxMovement: number;
  maxNumbers: number;
  maxOperations: number;
  version: 1 | 2 | 3;
  bugs: number;
  numbers: number[];
  pendingOperations: OperationKind[];
  compiledProgram?: CompiledProgram;
  destroyed: boolean;
  hasInterceptedThisTurn: boolean;
  statusEffects?: StatusEffect[];
  tempBuffs?: TempBuff[];
  attacks: BotAttackSlots;
}

export interface PlayerState {
  alias: string;
  listId: string;
}

export interface BattleState {
  id: string;
  status: 'in_progress' | 'finished';
  phase: Phase;
  turn: number;
  activationOrder: string[];
  currentActivationIdx: number;
  cpuPriority: PlayerId;
  players: Record<PlayerId, PlayerState>;
  bots: BattleBot[];
  hexMap: HexMapData;
  entities?: MapEntity[];
  winner?: PlayerId;
  /** Marcada como Debug — true tras emitir 'debug_enabled'. Una vez true, no vuelve a false. */
  debug?: boolean;
}

export type BattleEventKind =
  | 'deployed'
  | 'criterion_chosen'
  | 'ppt_rolled'
  | 'ppt_tie'
  | 'ppt_starter_set'
  | 'color_rolled'
  | 'init_ppt'
  | 'upgrade'
  | 'boot_energy_rolled'
  | 'boot_numbers_rolled'
  | 'boot_operations_rolled'
  | 'compile_committed'
  | 'operation_resolved'
  | 'intercept'
  | 'move'
  | 'attack_hit'
  | 'attack_miss'
  | 'shield_up'
  | 'overload'
  | 'bug_added'
  | 'bug_purged'
  | 'destroyed'
  | 'debug_action'
  | 'status_applied'
  | 'status_resisted'
  | 'status_expired'
  | 'healed'
  | 'moved'
  | 'buff_applied'
  | 'buff_consumed'
  | 'numbers_lost'
  | 'entity_placed'
  | 'entity_destroyed'
  | 'turn_ended'
  | 'round_ended'
  | 'phase_changed'
  | 'victory'
  | 'debug_enabled'
  | 'debug_override'
  | 'debug_dice_forced';

export interface BattleEvent {
  turn: number;
  activation: number;
  phase: Phase;
  timestamp: string;
  botId?: string;
  kind: BattleEventKind;
  payload: Record<string, unknown>;
}

export interface BattleReport {
  id: string;
  title: string;
  scenarioId?: string | null;
  list1Id: string;
  list2Id: string;
  player1Alias: string;
  player2Alias: string;
  status: 'in_progress' | 'finished';
  winner?: PlayerId | null;
  initialSnapshot: BattleState;
  events: BattleEvent[];
  finalState?: BattleState | null;
  createdAt: string;
  updatedAt: string;
}

export interface BattleReportSummary {
  id: string;
  title: string;
  status: 'in_progress' | 'finished';
  winner: PlayerId | null;
  player1Alias: string;
  player2Alias: string;
  createdAt: string;
  isDebug?: boolean;
}

export const OPERATION_LABEL: Record<OperationKind, string> = {
  IF: 'IF',
  IF_ELSE: 'IF-ELSE',
  FOR: 'FOR',
  WHILE: 'WHILE',
  TRY_CATCH: 'TRY-CATCH',
};

export const COMPARATORS: Comparator[] = ['<', '<=', '>=', '>', '!=', '=='];

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}
