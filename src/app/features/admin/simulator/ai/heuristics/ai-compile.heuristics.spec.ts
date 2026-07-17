import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../../shared/types/battle.types';
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
    maxMovement: 3, maxNumbers: 8, maxOperations: 4, version: 1, bugs: 0,
    numbers: [], pendingOperations: ['IF', 'IF_ELSE', 'FOR', 'WHILE'],
    destroyed: false, hasInterceptedThisTurn: false,
    attacks: { v1: [{ functionId: 'powerSmash' }, null], v2: [{ functionId: 'plasmaBolt' }], v3: { functionId: 'railgun' } },
    ...over,
  } as BattleBot;
}

const st = { bots: [], hexMap: { hexTypes: [], hexes: [], deployments: [] } } as unknown as BattleState;
const fmap = new Map();

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

describe('buildProgram N1 — programa siempre válido', () => {
  it('sobre 200 semillas: respeta slots, ≤1 loop, ops del pool y firmas distintas', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = seeded(seed);
      const b = bot({ bugs: seed % 3, version: ((seed % 3) + 1) as 1 | 2 | 3 });
      const prog = buildProgram(b, st, fmap, 1, [], rand);
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
  });

  it('sin slots o sin pool → programa vacío', () => {
    expect(buildProgram(bot({ bugs: 4 }), st, fmap, 1, [], seeded(1)).operations).toEqual([]);
    expect(buildProgram(bot({ pendingOperations: [] }), st, fmap, 1, [], seeded(1)).operations).toEqual([]);
  });
});
