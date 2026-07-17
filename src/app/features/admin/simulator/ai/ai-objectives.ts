import type { BattleState } from '../../../../shared/types/battle.types';
import type { MarkerType } from '../../../../shared/components/hex-map/hex-map.types';

/** Costura para campañas: cuando los escenarios tengan objetivos formalizados,
 *  `buildObjectives` los parseará desde ScenarioData y `objectiveBias` los
 *  ponderará en los scores de las heurísticas N2/N3 — sin tocar firmas. */
export type AiObjectiveKind =
  | 'annihilation'
  | 'capture'
  | 'defend-zone'
  | 'reach-zone'
  | 'survive-rounds';

export interface AiObjective {
  kind: AiObjectiveKind;
  /** Zonas o marcadores relevantes en el tablero. */
  hexes?: Array<{ q: number; r: number }>;
  markerTypes?: MarkerType[];
  roundLimit?: number;
  /** Prioridad relativa (annihilation = 1). */
  weight: number;
}

/** Contexto que las heurísticas pasan al hook de scoring. */
export interface ObjectiveBiasCtx {
  kind: 'move' | 'target' | 'deploy';
  botId: string;
  hex?: { q: number; r: number };
  targetId?: string;
}

export function buildObjectives(state: BattleState, scenarioId?: string | null): AiObjective[] {
  void state;
  void scenarioId;
  // TODO campañas: parsear ScenarioData (objetivo, marcadores treasure/flag/plaque/threat)
  // y devolver objetivos adicionales con su peso.
  return [{ kind: 'annihilation', weight: 1 }];
}

export function objectiveBias(
  objectives: AiObjective[],
  ctx: ObjectiveBiasCtx,
): number {
  void objectives;
  void ctx;
  // TODO campañas: puntuar el hex/objetivo según los objetivos del escenario.
  return 0;
}
