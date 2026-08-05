import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../shared/types/battle.types';
import { initialRunState, type RunState } from '../simulator-run.utils';
import { detectPendingDecision } from './ai-decisions';
import type { AiSnapshot } from './ai.types';

function bot(over: Partial<BattleBot>): BattleBot {
  return {
    id: 'b1', name: 'Bot', playerId: 1, q: 0, r: 0,
    life: 10, maxLife: 10, energy: 10, maxEnergy: 10, shield: 0, maxShield: 3,
    maxMovement: 3, maxNumbers: 8, maxOperations: 4, version: 1, bugs: 0,
    numbers: [1, 3, 5], pendingOperations: [], destroyed: false,
    hasInterceptedThisTurn: false, attacks: { v1: [], v2: [], v3: null },
    ...over,
  } as BattleBot;
}

function state(over: Partial<BattleState>): BattleState {
  return {
    id: 'x', status: 'in_progress', phase: 'run', turn: 1,
    activationOrder: [], currentActivationIdx: 0, cpuPriority: 1,
    players: {
      1: { alias: 'A', listId: '', controller: { kind: 'cpu', level: 1 } },
      2: { alias: 'B', listId: '', controller: { kind: 'human' } },
    },
    bots: [], hexMap: { hexTypes: [], hexes: [], deployments: [] },
    ...over,
  } as BattleState;
}

function snap(over: Partial<AiSnapshot>): AiSnapshot {
  return {
    state: state({}),
    seq: 0,
    runState: initialRunState,
    subPhase: 'done',
    initSubPhase: 'done',
    choiceP1: null, choiceP2: null,
    deployPptWinner: null, initPptWinner: null,
    deployStarter: 1,
    initStarted: false,
    pendingRoll: null, rollingColor: false, rollingPpt: false,
    activeDeployer: null,
    nextBootBot: null, bootRollingFor: null,
    nextCompileBot: null, currentRunBot: null,
    interceptBot: null,
    selectableHexes: null,
    peekRevealPlayer: null,
    chargedAnimating: false,
    ...over,
  };
}

function rs(over: Partial<RunState>): RunState {
  return { ...initialRunState, ...over };
}

describe('detectPendingDecision — fin y transitorios', () => {
  it('null con partida finalizada', () => {
    expect(detectPendingDecision(snap({ state: state({ status: 'finished' }) }))).toBeNull();
  });

  it('null en pasos transitorios (rolling, between-iters)', () => {
    const b = bot({});
    for (const step of ['rolling', 'between-iters'] as const) {
      const s = snap({ currentRunBot: b, runState: rs({ botId: b.id, step }) });
      expect(detectPendingDecision(s)).toBeNull();
    }
  });
});

describe('detectPendingDecision — deploy', () => {
  const deployState = state({ phase: 'deploy' });

  it('criterion: P1 primero, luego P2', () => {
    const base = { state: deployState, deployStarter: null, subPhase: 'criterion' as const };
    expect(detectPendingDecision(snap(base))).toEqual({ kind: 'criterion', owner: 1 });
    expect(detectPendingDecision(snap({ ...base, choiceP1: 'ppt' }))).toEqual({ kind: 'criterion', owner: 2 });
  });

  it('ppt-roll con owner correcto y gate de animación', () => {
    const base = { state: deployState, deployStarter: null, subPhase: 'ppt-p2' as const };
    expect(detectPendingDecision(snap(base))).toEqual({ kind: 'ppt-roll', owner: 2, context: 'deploy' });
    expect(detectPendingDecision(snap({ ...base, rollingPpt: true }))).toBeNull();
  });

  it('ppt-result: repeat en empate, confirm con ganador (shared)', () => {
    const base = { state: deployState, deployStarter: null, subPhase: 'ppt-result' as const };
    expect(detectPendingDecision(snap(base))?.kind).toBe('ppt-repeat');
    expect(detectPendingDecision(snap({ ...base, deployPptWinner: 2 }))).toEqual(
      { kind: 'ppt-confirm', owner: 'shared', context: 'deploy' },
    );
  });

  it('dado de colores y colocación según pendingRoll', () => {
    const base = { state: deployState, activeDeployer: 2 as const };
    expect(detectPendingDecision(snap(base))).toEqual({ kind: 'color-roll', owner: 2 });
    expect(detectPendingDecision(snap({ ...base, rollingColor: true }))).toBeNull();
    expect(detectPendingDecision(snap({ ...base, pendingRoll: 'green', selectableHexes: ['0,0', '1,0'] })))
      .toEqual({ kind: 'deploy-hex', owner: 2, options: ['0,0', '1,0'] });
    // Colisión lógica: color tirado sin ningún hex válido. Sigue siendo una
    // decisión de despliegue, con options vacío — el controlador la resuelve
    // re-tirando el dado, igual que el botón del humano. Si aquí devolviera
    // null, la partida se quedaría colgada sin decisión pendiente.
    expect(detectPendingDecision(snap({ ...base, pendingRoll: 'orange', selectableHexes: [] })))
      .toEqual({ kind: 'deploy-hex', owner: 2, options: [] });
  });
});

describe('detectPendingDecision — boot / compile / init / end', () => {
  it('boot con owner del bot, gated por animación de tirada', () => {
    const b = bot({ id: 'p2-0', playerId: 2 });
    expect(detectPendingDecision(snap({ nextBootBot: b }))).toEqual({ kind: 'boot', owner: 2, botId: 'p2-0' });
    expect(detectPendingDecision(snap({ nextBootBot: b, bootRollingFor: 'p2-0' }))).toBeNull();
  });

  it('compile con owner del bot', () => {
    const b = bot({ id: 'p1-1', playerId: 1 });
    expect(detectPendingDecision(snap({ nextCompileBot: b }))).toEqual({ kind: 'compile', owner: 1, botId: 'p1-1' });
  });

  it('init ppt y nueva ronda', () => {
    expect(detectPendingDecision(snap({ initStarted: true, initSubPhase: 'ppt-p1' })))
      .toEqual({ kind: 'ppt-roll', owner: 1, context: 'init' });
    expect(detectPendingDecision(snap({ initStarted: true, initSubPhase: 'ppt-result', initPptWinner: 1 })))
      .toEqual({ kind: 'ppt-confirm', owner: 'shared', context: 'init' });
    expect(detectPendingDecision(snap({ state: state({ phase: 'end' }) })))
      .toEqual({ kind: 'new-round', owner: 'shared' });
  });
});

describe('detectPendingDecision — run', () => {
  const b = bot({ id: 'p1-0', playerId: 1 });
  const withStep = (step: RunState['step'], extra: Partial<AiSnapshot> = {}) =>
    snap({ currentRunBot: b, runState: rs({ botId: b.id, step }), ...extra });

  it('mapea cada step a su decisión con owner del bot activo', () => {
    expect(detectPendingDecision(withStep('idle'))).toEqual({ kind: 'resolve-op', owner: 1, botId: b.id });
    expect(detectPendingDecision(withStep('picking-number')))
      .toEqual({ kind: 'pick-number', owner: 1, botId: b.id, options: [1, 3, 5] });
    expect(detectPendingDecision(withStep('picking-hex', { selectableHexes: ['1,0'] })))
      .toEqual({ kind: 'move-hex', owner: 1, botId: b.id, options: ['1,0'] });
    expect(detectPendingDecision(withStep('picking-target', { selectableHexes: ['2,0'] })))
      .toEqual({ kind: 'target', owner: 1, botId: b.id, options: ['2,0'] });
    expect(detectPendingDecision(withStep('op-done'))).toEqual({ kind: 'advance-op', owner: 1, botId: b.id });
    expect(detectPendingDecision(withStep('evaluated'))).toEqual({ kind: 'advance-op', owner: 1, botId: b.id });
    expect(detectPendingDecision(withStep('debug'))).toEqual({ kind: 'debug-phase', owner: 1, botId: b.id });
    expect(detectPendingDecision(withStep('bot-done'))).toEqual({ kind: 'finish-bot', owner: 1, botId: b.id });
  });

  it('el intercept pertenece al RIVAL, no al bot activo', () => {
    const rival = bot({ id: 'p2-0', playerId: 2, numbers: [2, 4] });
    expect(detectPendingDecision(withStep('intercept-prompt', { interceptBot: rival })))
      .toEqual({ kind: 'intercept-decide', owner: 2, interceptorId: 'p2-0' });
    expect(detectPendingDecision(withStep('intercept-picking', { interceptBot: rival })))
      .toEqual({ kind: 'intercept-number', owner: 2, interceptorId: 'p2-0', options: [2, 4] });
  });

  it('charged gated por animación del d4', () => {
    expect(detectPendingDecision(withStep('charged-rolling'))).toEqual({ kind: 'charged', owner: 1, botId: b.id });
    expect(detectPendingDecision(withStep('charged-rolling', { chargedAnimating: true }))).toBeNull();
  });

  it('peek-ack tiene prioridad y owner del jugador que espía', () => {
    expect(detectPendingDecision(withStep('op-done', { peekRevealPlayer: 2 })))
      .toEqual({ kind: 'peek-ack', owner: 2 });
  });
});
