import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { buildProgram, availableFunctions } from './ai-compile.heuristics';
import type { RandomFn } from '../ai.types';

/** RNG determinista sembrado (LCG). */
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
    numbers: [], pendingOperations: ['IF', 'IF_ELSE', 'FOR', 'TRY_CATCH'],
    destroyed: false, hasInterceptedThisTurn: false,
    attacks: { v1: [{ functionId: 'powerSmash' }, null], v2: [{ functionId: 'plasmaBolt' }], v3: { functionId: 'railgun' } },
    ...over,
  } as BattleBot;
}

/** Rejilla transitable de radio 9 — computeAttackTargets necesita mapa real. */
function state(over: Partial<BattleState>): BattleState {
  const hexes = [];
  for (let q = -9; q <= 9; q++) {
    for (let r = -9; r <= 9; r++) {
      if (Math.abs(q + r) > 9) continue;
      hexes.push({ q, r, typeId: 'floor' });
    }
  }
  return {
    id: 'x', status: 'in_progress', phase: 'compile', turn: 1,
    activationOrder: [], currentActivationIdx: 0, cpuPriority: 1,
    players: { 1: { alias: 'A', listId: '' }, 2: { alias: 'B', listId: '' } },
    bots: [],
    hexMap: { hexTypes: [{ id: 'floor', name: 'Suelo', color: '#000', borderColor: '#111', properties: {}, builtIn: true }], hexes, deployments: [] },
    ...over,
  } as BattleState;
}

const fmap: Map<string, FunctionEntry> = new Map([
  ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '2', cost: '—', effects: '' }],
]);

const st = state({});

describe('availableFunctions — reglas del editor', () => {
  it('V1 solo ve ataques v1; V3 los ve todos', () => {
    const ids = (b: BattleBot) => availableFunctions(b)
      .filter(f => f.type === 'attack').map(f => f.attackFunctionId);
    expect(ids(bot({ version: 1 }))).toEqual(['powerSmash']);
    expect(ids(bot({ version: 3 }))).toEqual(['powerSmash', 'plasmaBolt', 'railgun']);
  });

  it('DMZ bloquea todos los ataques', () => {
    const b = bot({ statusEffects: [{ kind: 'DMZ', appliedTurn: 1 }] });
    expect(availableFunctions(b).map(f => f.type)).toEqual(['move', 'shield']);
  });
});

describe('buildProgram — programa siempre válido (todos los niveles)', () => {
  it('sobre 300 semillas y niveles: respeta slots, ≤1 loop, ops del pool y firmas distintas', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const level of [1, 2, 3] as const) {
        const rand = seeded(seed * level);
        const enemy = bot({ id: 'e1', playerId: 2, q: (seed % 8) + 1, r: 0 });
        const b = bot({ bugs: seed % 3, version: ((seed % 3) + 1) as 1 | 2 | 3 });
        const prog = buildProgram(b, state({ bots: [b, enemy] }), fmap, level, [], rand);
        const slots = Math.max(0, b.maxOperations - b.bugs);
        expect(prog.operations.length).toBeLessThanOrEqual(slots);
        expect(prog.operations.filter(o => o.kind === 'FOR' || o.kind === 'WHILE').length).toBeLessThanOrEqual(1);
        const pool = [...b.pendingOperations];
        for (const op of prog.operations) {
          const i = pool.indexOf(op.kind);
          expect(i).toBeGreaterThanOrEqual(0);
          pool.splice(i, 1);
          expect(op.primary).toBeDefined();
          if (op.secondary) expect(op.secondary.type).not.toBe(op.primary.type);
        }
      }
    }
  });

  it('sin slots o sin pool → programa vacío', () => {
    expect(buildProgram(bot({ bugs: 4 }), st, fmap, 1, [], seeded(1)).operations).toEqual([]);
    expect(buildProgram(bot({ pendingOperations: [] }), st, fmap, 1, [], seeded(1)).operations).toEqual([]);
  });
});

describe('buildProgram N2/N3 — plan de turno', () => {
  const kinds = (b: BattleBot, s: BattleState, level: 2 | 3) =>
    buildProgram(b, s, fmap, level, [], seeded(5)).operations;

  it('enemigo INALCANZABLE este turno → solo aproximación, cero ataques', () => {
    // dist 9, range 1, mov 2 → movesNeeded 4 > slots−1 (3) → todo moves
    const enemy = bot({ id: 'e1', playerId: 2, q: 9, r: 0 });
    const b = bot({});
    for (const level of [2, 3] as const) {
      const ops = kinds(b, state({ bots: [b, enemy] }), level);
      expect(ops.every(o => o.primary.type !== 'attack')).toBe(true);
      expect(ops.some(o => o.primary.type === 'move')).toBe(true);
    }
  });

  it('enemigo alcanzable tras moverse → moves primero, ataques después', () => {
    // dist 3, range 1, mov 2 → movesNeeded 1
    const enemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const b = bot({});
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops[0].primary.type).toBe('move');
    expect(ops.some(o => o.primary.type === 'attack')).toBe(true);
    const firstAttack = ops.findIndex(o => o.primary.type === 'attack');
    expect(firstAttack).toBeGreaterThan(0);
  });

  it('a alcance → ráfaga de ataques, sin moves por delante', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({});
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops[0].primary.type).toBe('attack');
  });

  it('el loop nunca cae en un ataque cuando hay que acercarse varias veces', () => {
    // dist 5, range 1, mov 2 → movesNeeded 2 → FOR(move)
    const enemy = bot({ id: 'e1', playerId: 2, q: 5, r: 0 });
    const b = bot({});
    for (const level of [2, 3] as const) {
      const ops = kinds(b, state({ bots: [b, enemy] }), level);
      const loop = ops.find(o => o.kind === 'FOR' || o.kind === 'WHILE');
      expect(loop?.primary.type).toBe('move');
    }
  });

  it('los ataques van en TRY_CATCH cuando está disponible (auto-protección del motor)', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({});
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    const firstAttack = ops.find(o => o.primary.type === 'attack');
    expect(firstAttack?.kind === 'TRY_CATCH' || firstAttack?.kind === 'FOR').toBe(true);
  });

  it('N3 limita los ataques al presupuesto de energía', () => {
    // energía 3, coste 2 → 1 ataque pagable aunque haya 4 slots
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 3 });
    const ops = kinds(b, state({ bots: [b, enemy] }), 3);
    expect(ops.filter(o => o.primary.type === 'attack').length).toBe(1);
  });

  it('arma LR desalineada: distancia dentro de rango pero SIN objetivo real → mueve primero', () => {
    // laserBeam alcanza 8 hexes pero solo en los 6 ejes. Enemigo a dist 3 fuera de eje:
    // el plan por distancia diría "a tiro" y compilaría ataques que solo pueden fallar
    const fmapLR: Map<string, FunctionEntry> = new Map([
      ['laserBeam', { id: 'laserBeam', func_name: 'laserBeam()', func_type: 'attack', version: '1', range: '2-8 (LR)', damage: '2', energy: '3', cost: '—', effects: '' }],
    ]);
    const b = bot({ attacks: { v1: [{ functionId: 'laserBeam' }], v2: [], v3: null } });
    const misaligned = bot({ id: 'e1', playerId: 2, q: 2, r: 1 });
    for (const level of [2, 3] as const) {
      const ops = buildProgram(b, state({ bots: [b, misaligned] }), fmapLR, level, [], seeded(7)).operations;
      expect(ops[0].primary.type).toBe('move');
    }
  });

  it('con vida baja y amenaza cerca antepone shield', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ life: 3, maxLife: 10 });
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops[0].primary.type).toBe('shield');
  });
});
