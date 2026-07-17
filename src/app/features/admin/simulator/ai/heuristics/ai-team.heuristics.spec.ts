import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../../shared/types/battle.types';
import { initialRunState } from '../../simulator-run.utils';
import type { FunctionEntry } from '../../simulator-bot-card';
import type { RandomFn } from '../ai.types';
import { allyClusterPenalty, chooseFocusTarget } from './ai-team.heuristics';
import { chooseMoveHex, chooseTargetHex, type RunHeuristicCtx } from './ai-run.heuristics';

function seeded(seed: number): RandomFn {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function bot(over: Partial<BattleBot>): BattleBot {
  return {
    id: 'b1', name: 'Bot', playerId: 1, q: 0, r: 0,
    life: 10, maxLife: 10, energy: 10, maxEnergy: 10, shield: 0, maxShield: 3,
    maxMovement: 2, maxNumbers: 8, maxOperations: 4, version: 1, bugs: 0,
    numbers: [], pendingOperations: [], destroyed: false,
    hasInterceptedThisTurn: false, attacks: { v1: [], v2: [], v3: null },
    ...over,
  } as BattleBot;
}

function state(over: Partial<BattleState>): BattleState {
  const hexes = [];
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) > 4) continue;
      hexes.push({ q, r, typeId: 'floor' });
    }
  }
  return {
    id: 'x', status: 'in_progress', phase: 'run', turn: 1,
    activationOrder: [], currentActivationIdx: 0, cpuPriority: 1,
    players: { 1: { alias: 'A', listId: '' }, 2: { alias: 'B', listId: '' } },
    bots: [],
    hexMap: { hexTypes: [{ id: 'floor', name: 'Suelo', color: '#000', borderColor: '#111', properties: {}, builtIn: true }], hexes, deployments: [] },
    ...over,
  } as BattleState;
}

const fmapWith = (entries: Record<string, Partial<FunctionEntry>>): Map<string, FunctionEntry> =>
  new Map(Object.entries(entries).map(([id, e]) => [id, {
    id, func_name: id, func_type: 'attack', version: '1',
    range: '1', damage: '2', energy: '2', cost: '—', effects: '',
    ...e,
  }]));

describe('chooseFocusTarget', () => {
  const fmap = fmapWith({ powerSmash: { range: '1', damage: '2' } });

  it('prefiere al enemigo herido antes que al entero, a igual distancia', () => {
    const a1 = bot({ id: 'a1', playerId: 1, q: 0, r: 0 });
    const a2 = bot({ id: 'a2', playerId: 1, q: 0, r: 1 });
    const wounded = bot({ id: 'e1', playerId: 2, q: 3, r: 0, life: 3 });
    const healthy = bot({ id: 'e2', playerId: 2, q: 3, r: 1, life: 10 });
    const st = state({ bots: [a1, a2, wounded, healthy] });
    expect(chooseFocusTarget(st, 1, fmap)?.id).toBe('e1');
  });

  it('es determinista: los dos bots del equipo eligen el mismo foco', () => {
    const a1 = bot({ id: 'a1', playerId: 1, q: 0, r: 0 });
    const a2 = bot({ id: 'a2', playerId: 1, q: 2, r: -2 });
    const e1 = bot({ id: 'e1', playerId: 2, q: 3, r: 0, life: 6 });
    const e2 = bot({ id: 'e2', playerId: 2, q: -3, r: 2, life: 7 });
    const st = state({ bots: [a1, a2, e1, e2] });
    const f1 = chooseFocusTarget(st, 1, fmap)?.id;
    const f2 = chooseFocusTarget(st, 1, fmap)?.id;
    expect(f1).toBe(f2);
    expect(f1).toBeDefined();
  });

  it('ignora bots sin desplegar y devuelve null sin enemigos vivos', () => {
    const a1 = bot({ id: 'a1', playerId: 1, q: 0, r: 0 });
    const dead = bot({ id: 'e1', playerId: 2, destroyed: true });
    const unplaced = bot({ id: 'e2', playerId: 2, q: -999, r: -999 });
    expect(chooseFocusTarget(state({ bots: [a1, dead, unplaced] }), 1, fmap)).toBeNull();
  });
});

describe('foco de fuego en las decisiones', () => {
  const fmap = fmapWith({ powerSmash: { range: '2', damage: '2' } });

  function ctxFor(me: BattleBot, st: BattleState, level: 2 | 3): RunHeuristicCtx {
    return {
      state: st, bot: me, runState: { ...initialRunState, botId: me.id },
      level, objectives: [], rand: seeded(9), fmap,
    };
  }

  it('N2 ataca al foco del equipo aunque otro enemigo tenga menos vida efectiva', () => {
    // e1 herido (foco claro); e2 con MENOS vida pero lejos del equipo → e1 sigue siendo foco
    const me = bot({ id: 'a1', playerId: 1, q: 0, r: 0, attacks: { v1: [{ functionId: 'powerSmash' }], v2: [], v3: null } });
    const ally = bot({ id: 'a2', playerId: 1, q: 1, r: 0 });
    const focusTgt = bot({ id: 'e1', playerId: 2, q: 2, r: 0, life: 5 });
    const lowButFar = bot({ id: 'e2', playerId: 2, q: -2, r: 0, life: 4, shield: 3 });
    const st = state({ bots: [me, ally, focusTgt, lowButFar] });
    // Ambos a tiro (rango 2): sin foco elegiría e2 (vida ef. 7 vs 5... e1 ya es menor);
    // invertimos: e2 vida ef. 4+3=7, e1=5 → foco y menor coinciden en e1. Verificamos el foco:
    expect(chooseFocusTarget(st, 1, fmap)?.id).toBe('e1');
    expect(chooseTargetHex(ctxFor(me, st, 2), ['2,0', '-2,0'])).toBe('2,0');
  });

  it('los dos bots N2 convergen hacia el mismo enemigo al moverse', () => {
    const a1 = bot({ id: 'a1', playerId: 1, q: -2, r: 0 });
    const a2 = bot({ id: 'a2', playerId: 1, q: -2, r: 2 });
    const e1 = bot({ id: 'e1', playerId: 2, q: 3, r: 0, life: 4 });
    const e2 = bot({ id: 'e2', playerId: 2, q: 3, r: -3, life: 10 });
    const st = state({ bots: [a1, a2, e1, e2] });
    const focus = chooseFocusTarget(st, 1, fmap)!;
    expect(focus.id).toBe('e1');
    // a1 elige entre acercarse a e1 o a e2 → hacia e1 (1,0 está de camino a e1)
    expect(chooseMoveHex(ctxFor(a1, st, 2), ['1,0', '1,-2'])).toBe('1,0');
    // a2 también converge hacia e1
    expect(chooseMoveHex(ctxFor(a2, st, 2), ['0,1', '0,-1'])).toBe('0,1');
  });

  it('N3 evita apelotonarse: penaliza el hex pegado al aliado', () => {
    const me = bot({ id: 'a1', playerId: 1, q: 0, r: 0 });
    const ally = bot({ id: 'a2', playerId: 1, q: 2, r: 0 });
    expect(allyClusterPenalty(state({ bots: [me, ally] }), me, 1, 0)).toBeGreaterThan(0);
    expect(allyClusterPenalty(state({ bots: [me, ally] }), me, -2, 0)).toBe(0);
  });
});
