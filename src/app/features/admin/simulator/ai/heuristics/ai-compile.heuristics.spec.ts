import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../../shared/types/battle.types';
import type { FunctionEntry } from '../../simulator-bot-card';
import { buildProgram, availableFunctions, sanitizeProgram } from './ai-compile.heuristics';
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
        const legalKeys = new Set(availableFunctions(b).map(f => f.type === 'attack' ? `attack:${f.attackFunctionId}` : f.type));
        const keyOf = (f: { type: string; attackFunctionId?: string }) => f.type === 'attack' ? `attack:${f.attackFunctionId}` : f.type;
        for (const op of prog.operations) {
          const i = pool.indexOf(op.kind);
          expect(i).toBeGreaterThanOrEqual(0);
          pool.splice(i, 1);
          expect(op.primary).toBeDefined();
          expect(legalKeys.has(keyOf(op.primary))).toBe(true);
          if (op.secondary) {
            expect(op.kind === 'IF_ELSE' || op.kind === 'TRY_CATCH').toBe(true);
            expect(op.secondary.type).not.toBe(op.primary.type);
            expect(legalKeys.has(keyOf(op.secondary))).toBe(true);
          }
        }
      }
    }
  });

  it('IF_ELSE/TRY_CATCH jamás llevan ataque en ambas ramas, ni con dos ataques distintos', () => {
    // Bot con DOS ataques diferentes y enemigo a tiro: la tentación máxima de attack/attack
    const fmap2: Map<string, FunctionEntry> = new Map([
      ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '2', cost: '—', effects: '' }],
      ['rocketPunch', { id: 'rocketPunch', func_name: 'rocketPunch()', func_type: 'attack', version: '1', range: '1', damage: '1d4', energy: '2', cost: '—', effects: '' }],
    ]);
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    for (let seed = 1; seed <= 50; seed++) {
      for (const level of [1, 2, 3] as const) {
        const b = bot({
          pendingOperations: ['IF_ELSE', 'TRY_CATCH', 'IF_ELSE', 'TRY_CATCH'],
          attacks: { v1: [{ functionId: 'powerSmash' }, { functionId: 'rocketPunch' }], v2: [], v3: null },
        });
        const prog = buildProgram(b, state({ bots: [b, enemy] }), fmap2, level, [], seeded(seed * 7 + level));
        for (const op of prog.operations) {
          if (op.primary.type === 'attack' && op.secondary) {
            expect(op.secondary.type).not.toBe('attack');
          }
        }
      }
    }
  });

  it('sanitizeProgram repara un programa corrupto aplicando todas las reglas del editor', () => {
    const b = bot({ bugs: 1, version: 1, pendingOperations: ['IF', 'IF_ELSE', 'FOR', 'WHILE'] });
    // maxOperations 4 − 1 bug = 3 slots
    const corrupt = {
      operations: [
        // secundaria attack/attack (ilegal) → se poda la secundaria
        { kind: 'IF_ELSE' as const, primary: { type: 'attack' as const, attackFunctionId: 'powerSmash' }, secondary: { type: 'attack' as const, attackFunctionId: 'powerSmash' } },
        // ataque de V2 en un bot V1 (ilegal) → se elimina la op
        { kind: 'IF' as const, primary: { type: 'attack' as const, attackFunctionId: 'plasmaBolt' } },
        // segundo loop (ilegal, FOR y WHILE) → se elimina
        { kind: 'FOR' as const, primary: { type: 'move' as const } },
        { kind: 'WHILE' as const, primary: { type: 'move' as const } },
        // op que no está en el pool → se elimina
        { kind: 'TRY_CATCH' as const, primary: { type: 'shield' as const } },
        // válida, pero ya no cabe si se superan los slots
        { kind: 'IF' as const, primary: { type: 'move' as const } },
      ],
    };
    const clean = sanitizeProgram(b, corrupt);
    expect(clean.operations.length).toBeLessThanOrEqual(3);
    expect(clean.operations[0].kind).toBe('IF_ELSE');
    expect(clean.operations[0].secondary).toBeUndefined();
    expect(clean.operations.some(o => o.primary.type === 'attack' && o.primary.attackFunctionId === 'plasmaBolt')).toBe(false);
    expect(clean.operations.filter(o => o.kind === 'FOR' || o.kind === 'WHILE').length).toBe(1);
    expect(clean.operations.some(o => o.kind === 'TRY_CATCH')).toBe(false);
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

  it('N2 limita los ataques al presupuesto de energía, igual que N3', () => {
    // energía 3, coste 2 → 1 ataque pagable aunque haya 4 slots
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 3 });
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops.filter(o => o.primary.type === 'attack').length).toBe(1);
  });

  it('no compromete más energía de la que tiene (caso real: 10⚡ y ataque de 5⚡)', () => {
    // Partida dhwbh2m5, turno 4: N2 compiló FOR(traceShot) + 2 ataques más con
    // 10⚡ y traceShot a 5⚡ → 3 overloads seguidos y 9 de vida perdidos solo.
    const fmapCostly: Map<string, FunctionEntry> = new Map([
      ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '5', cost: '—', effects: '' }],
    ]);
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 10 });
    for (const level of [2, 3] as const) {
      const ops = buildProgram(b, state({ bots: [b, enemy] }), fmapCostly, level, [], seeded(5)).operations;
      const committed = ops.reduce((sum, o) => {
        const unit = o.primary.type === 'attack' ? 5 : o.primary.type === 'shield' ? 2 : b.maxMovement;
        return sum + (o.kind === 'FOR' || o.kind === 'WHILE' ? unit * 2 : unit);
      }, 0);
      expect(committed).toBeLessThanOrEqual(b.energy);
    }
  });

  it('sin bucle en el pool no reserva vueltas de bucle que no van a existir', () => {
    // Partida N3 real, turno 4: p2-0 con 11⚡ y plasmaBolt a 4⚡ compiló UNA
    // sola operación teniendo 3 slots. El deseo iba marcado `repeat`, se le
    // cobraron 2 vueltas (8⚡) y ya no cabía nada más — pero en el pool solo
    // había IF/IF_ELSE, así que jamás hubo bucle y el ataque se ejecutó una vez.
    const fmapCostly: Map<string, FunctionEntry> = new Map([
      ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '4', cost: '—', effects: '' }],
    ]);
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 11, pendingOperations: ['IF_ELSE', 'IF', 'IF'], maxOperations: 3 });
    const ops = buildProgram(b, state({ bots: [b, enemy] }), fmapCostly, 3, [], seeded(5)).operations;
    expect(ops.filter(o => o.primary.type === 'attack').length).toBeGreaterThanOrEqual(2);
  });

  it('N3 presupuesta las 3 vueltas del bucle que va a pedir en RUN', () => {
    // Mismo bot con 15⚡ y un FOR en el pool: N3 apunta a 3 iteraciones
    // (choosePickNumber), o sea 12⚡. Presupuestar solo 2 dejaba hueco para
    // otra operación que luego no se podía pagar → overload.
    const fmapCostly: Map<string, FunctionEntry> = new Map([
      ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '4', cost: '—', effects: '' }],
    ]);
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 15, pendingOperations: ['FOR', 'IF', 'IF_ELSE'], maxOperations: 3 });
    const ops = buildProgram(b, state({ bots: [b, enemy] }), fmapCostly, 3, [], seeded(5)).operations;
    const committed = ops.reduce((sum, o) => {
      const unit = o.primary.type === 'attack' ? 4 : o.primary.type === 'shield' ? 2 : b.maxMovement;
      return sum + (o.kind === 'FOR' || o.kind === 'WHILE' ? unit * 3 : unit);
    }, 0);
    expect(committed).toBeLessThanOrEqual(b.energy);
  });

  it('un primer deseo caro se degrada a ejecución simple, no tumba el programa', () => {
    // Si el bucle no cabe entero, hay que bajarlo a una ejecución antes de
    // descartarlo: si no, el bot se queda sin compilar nada con energía de sobra.
    const fmapCostly: Map<string, FunctionEntry> = new Map([
      ['powerSmash', { id: 'powerSmash', func_name: 'powerSmash()', func_type: 'attack', version: '1', range: '1', damage: '2', energy: '5', cost: '—', effects: '' }],
    ]);
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 10, pendingOperations: ['FOR', 'IF', 'IF_ELSE'], maxOperations: 3 });
    const ops = buildProgram(b, state({ bots: [b, enemy] }), fmapCostly, 3, [], seeded(5)).operations;
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.filter(o => o.primary.type === 'attack').length).toBe(2);
  });

  it('enemigo inalcanzable: ningún ataque, tampoco en la rama secundaria', () => {
    // Partida dhwbh2m5, turno 1: el plan era "solo aproximación", pero la rama
    // FALSE del primer IF_ELSE llevaba pulseShot() y la IA no pudo forzar TRUE
    // (cara `==`, d6 6, RAM sin ningún 6) → disparó al vacío → +1 bug.
    const enemy = bot({ id: 'e1', playerId: 2, q: 9, r: 0 });
    const b = bot({});
    for (const level of [2, 3] as const) {
      const ops = buildProgram(b, state({ bots: [b, enemy] }), fmap, level, [], seeded(5)).operations;
      for (const op of ops) {
        expect(op.primary.type).not.toBe('attack');
        expect(op.secondary?.type ?? 'none').not.toBe('attack');
      }
    }
  });

  it('con el pool lleno de bucles, deja el slot vacío antes que meter un ataque sin objetivos', () => {
    // Partida N3 real, turno 3: pool ["FOR","IF","IF"] y plan de aproximación.
    // El move y el primer ataque cogieron los dos IF, y al segundo ataque solo
    // le quedaba el FOR — que `opPreference` puntúa con un 9 pero acaba cogiendo
    // igual por ser lo único. FOR(laserBeam) sin objetivos = +1 🐛 seguro.
    // Distancia 3 con alcance 1: plan de aproximación → [move, ataque, ataque].
    // El move y el primer ataque cogen los IF y al segundo solo le queda el FOR.
    const enemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const b = bot({ pendingOperations: ['FOR', 'IF', 'IF'], maxOperations: 3 });
    for (const level of [2, 3] as const) {
      const ops = buildProgram(b, state({ bots: [b, enemy] }), fmap, level, [], seeded(5)).operations;
      const bucle = ops.find(o => o.kind === 'FOR' || o.kind === 'WHILE');
      expect(bucle?.primary.type ?? 'none').not.toBe('attack');
    }
  });

  it('ya a tiro: no rellena slots con `move`, que lo sacaría del alcance', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 6 });
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some(o => o.primary.type === 'move')).toBe(false);
  });

  it('sin energía no compila nada, en vez de caer en el programa aleatorio', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ energy: 0 });
    for (const level of [2, 3] as const) {
      const ops = buildProgram(b, state({ bots: [b, enemy] }), fmap, level, [], seeded(3)).operations;
      expect(ops).toEqual([]);
    }
  });

  it('con vida baja y amenaza cerca antepone shield', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const b = bot({ life: 3, maxLife: 10 });
    const ops = kinds(b, state({ bots: [b, enemy] }), 2);
    expect(ops[0].primary.type).toBe('shield');
  });
});
