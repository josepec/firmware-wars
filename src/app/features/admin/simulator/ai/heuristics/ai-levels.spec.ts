import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState } from '../../../../../shared/types/battle.types';
import { initialRunState } from '../../simulator-run.utils';
import type { FunctionEntry } from '../../simulator-bot-card';
import type { RandomFn } from '../ai.types';
import { chooseBootDice } from './ai-boot.heuristics';
import { buildProgram } from './ai-compile.heuristics';
import { chooseDeployHex } from './ai-deploy.heuristics';
import { chooseDebugActions } from './ai-debug.heuristics';
import { attackTacticalBonus } from './ai-scoring';
import {
  blockProbability,
  chooseInterceptNumber,
  decideIntercept,
  guaranteedBlockingValues,
  satisfyingCount,
  type InterceptCtx,
} from './ai-intercept.heuristics';
import {
  chooseChargedAction,
  chooseMoveHex,
  choosePickNumber,
  type RunHeuristicCtx,
} from './ai-run.heuristics';

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
    numbers: [], pendingOperations: [], destroyed: false,
    hasInterceptedThisTurn: false, attacks: { v1: [], v2: [], v3: null },
    ...over,
  } as BattleBot;
}

/** Rejilla 7×7 transitable. */
function state(over: Partial<BattleState>): BattleState {
  const hexes = [];
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.abs(q + r) > 3) continue;
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

function runCtx(over: Partial<RunHeuristicCtx>): RunHeuristicCtx {
  return {
    state: state({}),
    bot: bot({}),
    runState: initialRunState,
    level: 2,
    objectives: [],
    rand: seeded(7),
    fmap: new Map(),
    ...over,
  };
}

describe('chooseBootDice', () => {
  it('N2 no arriesga overflow en esperanza', () => {
    // 8/10: cualquier dado arriesga (8+3.5 > 10) y no va corto → 0
    expect(chooseBootDice(bot({ energy: 8, maxEnergy: 10 }), 2, seeded(1))).toBe(0);
    // 2/20: caben 3 dados de sobra
    expect(chooseBootDice(bot({ energy: 2, maxEnergy: 20 }), 2, seeded(1))).toBe(3);
    // 1/8: 1+3.5 ≤ 8 → 1 dado; 2 dados = 8 en esperanza ≤ 8 → 2
    expect(chooseBootDice(bot({ energy: 1, maxEnergy: 8 }), 2, seeded(1))).toBe(2);
  });

  it('N3 maximiza utilidad exacta: vacío → 3 dados, casi lleno → 0', () => {
    expect(chooseBootDice(bot({ energy: 0, maxEnergy: 20 }), 3, seeded(1))).toBe(3);
    expect(chooseBootDice(bot({ energy: 9, maxEnergy: 10 }), 3, seeded(1))).toBe(0);
  });
});

describe('choosePickNumber — forzado de rama', () => {
  const fmap = fmapWith({ powerSmash: { range: '1', damage: '2' } });
  const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
  const me = bot({
    id: 'm1', q: 0, r: 0,
    attacks: { v1: [{ functionId: 'powerSmash' }], v2: [], v3: null },
    compiledProgram: { operations: [{ kind: 'IF', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
  });
  const st = state({ bots: [me, enemy] });

  it('N2 fuerza TRUE cuando el ataque tiene objetivo a tiro', () => {
    const ctx = runCtx({
      state: st, bot: me, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // evaluate(3, n, '>=') → true con n ≤ 3: de [6, 2] debe elegir 2
    expect(choosePickNumber(ctx, [6, 2])).toBe(2);
  });

  it('N2 fuerza FALSE cuando el ataque no tiene objetivos (evita el bug)', () => {
    const farEnemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const ctx = runCtx({
      state: state({ bots: [me, farEnemy] }), bot: me, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // Quiere FALSE: evaluate(3, n, '>=') false con n > 3 → elige 6
    expect(choosePickNumber(ctx, [6, 2])).toBe(6);
  });

  it('N3 gasta el número menos flexible entre los que fuerzan', () => {
    const ctx = runCtx({
      state: st, bot: me, fmap, level: 3,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // Fuerzan TRUE: 2 y 3 (≤3). Flexibilidad: |2−3.5|=1.5 > |3−3.5|=0.5 → gasta el 3
    expect(choosePickNumber(ctx, [6, 2, 3])).toBe(3);
  });

  it('FOR con ataque SIN alcance: elige diff 0 — jamás itera un ataque que solo puede fallar', () => {
    const farEnemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const forMe = bot({
      ...me, id: 'm1',
      compiledProgram: { operations: [{ kind: 'FOR', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
    });
    const ctx = runCtx({
      state: state({ bots: [forMe, farEnemy] }), bot: forMe, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 4, opFace: '>=' },
    });
    // d6=4: n=4 → diff 0 (1 bug seco, cero MISses). Debe preferirlo a cualquier diff 1..3
    expect(choosePickNumber(ctx, [1, 4, 6])).toBe(4);
  });

  it('WHILE con ataque sin alcance: fuerza FALSE (no encadena MISses)', () => {
    const farEnemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const whileMe = bot({
      ...me, id: 'm1',
      compiledProgram: { operations: [{ kind: 'WHILE', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
    });
    const ctx = runCtx({
      state: state({ bots: [whileMe, farEnemy] }), bot: whileMe, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // FALSE con '>=' y d6=3 → n > 3 → elige 6
    expect(choosePickNumber(ctx, [6, 2])).toBe(6);
  });

  it('ataque IMPAGABLE: fuerza FALSE aunque haya objetivo (evita el overload)', () => {
    const poorMe = bot({
      ...me, id: 'm1', energy: 1,
      compiledProgram: { operations: [{ kind: 'IF', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
    });
    const ctx = runCtx({
      state: state({ bots: [poorMe, enemy] }), bot: poorMe, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // powerSmash cuesta 2⚡ y tiene 1: ejecutarlo = overload → FALSE (n > 3)
    expect(choosePickNumber(ctx, [6, 2])).toBe(6);
  });

  it('IF_ELSE(ataque sin objetivo, escudo LLENO): fuerza FALSE — un miss+bug pierde contra un escudo inútil', () => {
    // El caso de la partida real: SHIELD 1/1 y laserBeam sin nada a tiro → eligió TRUE y regaló un bug
    const farEnemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const fullShield = bot({
      ...me, id: 'm1', shield: 1, maxShield: 1,
      compiledProgram: {
        operations: [{
          kind: 'IF_ELSE',
          primary: { type: 'attack', attackFunctionId: 'powerSmash' },
          secondary: { type: 'shield' },
        }],
      },
    });
    const ctx = runCtx({
      state: state({ bots: [fullShield, farEnemy] }), bot: fullShield, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // FALSE con '>=' y d6=3 → n > 3 → 6
    expect(choosePickNumber(ctx, [6, 2])).toBe(6);
  });

  it('IF_ELSE con ambas ramas malas: elige la menos dañina', () => {
    // primaria: ataque impagable (overload −1); secundaria: move sin enemigo... usamos shield lleno (0)
    const poorMe = bot({
      ...me, id: 'm1', energy: 1, shield: 3, maxShield: 3,
      compiledProgram: {
        operations: [{
          kind: 'IF_ELSE',
          primary: { type: 'attack', attackFunctionId: 'powerSmash' },
          secondary: { type: 'shield' },
        }],
      },
    });
    const ctx = runCtx({
      state: state({ bots: [poorMe, enemy] }), bot: poorMe, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // attack = overload (negativo); shield lleno... pero shield también impagable con 1⚡ (cuesta 2).
    // shield: −(2−1)−1 = −2; attack: −(2−1)−1 = −2 → empate: primaria (TRUE) vale
    // Lo importante: no lanza excepción y devuelve una opción legal
    const n = choosePickNumber(ctx, [6, 2]);
    expect([6, 2]).toContain(n);
  });

  it('FOR(ataque): no compromete más iteraciones que golpes necesarios para el kill', () => {
    // Enemigo con vida efectiva 3 y daño 2 → 2 golpes bastan. Aunque N3 pueda pagar
    // 3 iteraciones, la 3ª dispararía a un bot ya destruido (MISS + bug) → cap en 2
    const frail = bot({ id: 'e1', playerId: 2, q: 1, r: 0, life: 3, shield: 0 });
    const forMe = bot({
      ...me, id: 'm1', energy: 10,
      compiledProgram: { operations: [{ kind: 'FOR', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
    });
    const ctx = runCtx({
      state: state({ bots: [forMe, frail] }), bot: forMe, fmap, level: 3,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 5 },
    });
    // diffs: n=3→2 ✓cap, n=2→3 (sobrepasa el kill), n=5→0 (bug) → elige 3
    expect(choosePickNumber(ctx, [3, 2, 5])).toBe(3);
  });

  it('FOR: elige n con diff válida 1..3', () => {
    const forMe = bot({
      ...me, id: 'm1',
      compiledProgram: { operations: [{ kind: 'FOR', primary: { type: 'attack', attackFunctionId: 'powerSmash' } }] },
    });
    const ctx = runCtx({
      state: st, bot: forMe, fmap,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 6, opFace: '>=' },
    });
    // diff de 6: n=6→0 (bug), n=1→5 (bug); n=5→1 válida → elige 5
    expect(choosePickNumber(ctx, [6, 1, 5])).toBe(5);
  });
});

describe('chooseMoveHex', () => {
  it('N2 se acerca al enemigo más próximo', () => {
    const enemy = bot({ id: 'e1', playerId: 2, q: 3, r: 0 });
    const me = bot({ id: 'm1', q: 0, r: 0 });
    const ctx = runCtx({ state: state({ bots: [me, enemy] }), bot: me });
    expect(chooseMoveHex(ctx, ['2,0', '-2,0', '0,1'])).toBe('2,0');
  });

  it('N3 con vida baja se retira del enemigo', () => {
    const fmap = fmapWith({ powerSmash: { range: '1', damage: '3' } });
    const enemy = bot({
      id: 'e1', playerId: 2, q: 2, r: 0,
      attacks: { v1: [{ functionId: 'powerSmash' }], v2: [], v3: null },
    });
    const me = bot({ id: 'm1', q: 0, r: 0, life: 3, maxLife: 10 });
    const ctx = runCtx({ state: state({ bots: [me, enemy] }), bot: me, level: 3, fmap });
    expect(chooseMoveHex(ctx, ['1,0', '-3,0'])).toBe('-3,0');
  });
});

describe('intercept', () => {
  const fmap = fmapWith({ powerSmash: { range: '1', damage: '2' } });

  function interceptCtx(over: Partial<InterceptCtx>): InterceptCtx {
    const active = bot({
      id: 'a1', playerId: 2, q: 1, r: 0, numbers: [2, 3],
      attacks: { v1: [{ functionId: 'powerSmash' }], v2: [], v3: null },
    });
    const interceptor = bot({ id: 'i1', playerId: 1, q: 0, r: 0, numbers: [1, 4] });
    return {
      state: state({ bots: [active, interceptor] }),
      interceptor, activeBot: active,
      op: { kind: 'IF', primary: { type: 'attack', attackFunctionId: 'powerSmash' } },
      opFace: '>',
      level: 2, rand: seeded(3), fmap,
      ...over,
    };
  }

  it('JUEGO LIMPIO: razona sin leer la RAM del rival — v=1 bloquea ">" contra cualquier mano', () => {
    // Con ">" y d6 sustituido por 1: ningún n ∈ 1..6 cumple 1 > n
    expect(satisfyingCount(1, '>')).toBe(0);
    expect(guaranteedBlockingValues(interceptCtx({}))).toEqual([1]);
    // v=4 con ">": 3 valores posibles del rival lo satisfarían → no garantizado
    expect(satisfyingCount(4, '>')).toBe(3);
    // La probabilidad solo usa la CANTIDAD de numbers del rival, nunca sus valores
    expect(blockProbability(1, '>', 5)).toBe(1);
    expect(blockProbability(4, '>', 2)).toBeCloseTo(0.25, 5);
  });

  it('N2 intercepta un ataque bloqueable garantizado y elige el número bloqueante', () => {
    const ctx = interceptCtx({});
    expect(decideIntercept(ctx)).toBe(true);
    expect(chooseInterceptNumber(ctx, [1, 4])).toBe(1);
  });

  it('N1 nunca intercepta; sin bloqueo garantizado N2 tampoco', () => {
    expect(decideIntercept(interceptCtx({ level: 1 }))).toBe(false);
    const noBlock = interceptCtx({ interceptor: bot({ id: 'i1', playerId: 1, q: 0, r: 0, numbers: [4] }) });
    expect(decideIntercept(noBlock)).toBe(false);
  });

  it('N3 acepta bloqueos probables usando solo la cantidad de numbers del rival', () => {
    // v=1 con '>' bloquea seguro → N3 intercepta también
    expect(decideIntercept(interceptCtx({ level: 3 }))).toBe(true);
  });
});

describe('chooseChargedAction', () => {
  it('N2 se planta con acumulado ≥ 3', () => {
    const at = (accum: number) => runCtx({ runState: { ...initialRunState, chargedAccum: accum } });
    expect(chooseChargedAction(at(2))).toBe('more');
    expect(chooseChargedAction(at(3))).toBe('stop');
  });

  it('N3 se planta al asegurar el kill', () => {
    const target = bot({ id: 't1', playerId: 2, life: 4, shield: 0 });
    const ctx = runCtx({
      level: 3,
      state: state({ bots: [bot({}), target] }),
      runState: { ...initialRunState, chargedAccum: 4, chargedTargetId: 't1' },
    });
    expect(chooseChargedAction(ctx)).toBe('stop');
  });
});

describe('chooseDebugActions', () => {
  it('N2: patch con muchos bugs, debug sueltos con reserva', () => {
    expect(chooseDebugActions(bot({ bugs: 3, energy: 10 }), 2, seeded(1)))
      .toEqual([{ action: 'patch' }]);
    expect(chooseDebugActions(bot({ bugs: 1, energy: 10 }), 2, seeded(1)))
      .toEqual([{ action: 'debug' }]);
    expect(chooseDebugActions(bot({ bugs: 2, energy: 3 }), 2, seeded(1))).toEqual([]);
  });

  it('N3: reboot si el bot quedó inutilizado', () => {
    expect(chooseDebugActions(bot({ bugs: 3, maxOperations: 4, energy: 1 }), 3, seeded(1)))
      .toEqual([{ action: 'reboot' }]);
  });
});

describe('chooseDeployHex', () => {
  it('N2 despliega junto a los aliados ya colocados', () => {
    const ally = bot({ id: 'a1', playerId: 1, q: -2, r: 0 });
    const st = state({ phase: 'deploy', bots: [ally] });
    expect(chooseDeployHex(st, 1, ['-1,0', '3,0'], 2, [], seeded(1))).toBe('-1,0');
  });

  it('N3 prefiere cobertura: junto a un obstáculo antes que en campo abierto', () => {
    const st = state({ phase: 'deploy', bots: [] });
    st.hexMap.hexTypes.push({ id: 'wall', name: 'Muro', color: '#000', borderColor: '#111', properties: { traversable: 'false' }, builtIn: true });
    // Obstáculo en (1,0): la opción (1,-1) es adyacente; (-1,1) es simétrica respecto al centro pero abierta
    st.hexMap.hexes.find(h => h.q === 1 && h.r === 0)!.typeId = 'wall';
    expect(chooseDeployHex(st, 1, ['1,-1', '-1,1'], 3, [], seeded(1))).toBe('1,-1');
  });
});

describe('valor táctico de los efectos', () => {
  it('dataSpike (mete bug) suma; novaBlast (bug propio) resta', () => {
    expect(attackTacticalBonus('dataSpike')).toBeGreaterThan(0);
    expect(attackTacticalBonus('novaBlast')).toBeLessThan(0);
    expect(attackTacticalBonus('rocketPunch()')).toBe(0);
  });

  it('a igual daño, el compilador prefiere el ataque con mejor efecto', () => {
    // Mismo daño/coste/rango: syncBlast (+0.3) debe ganar a novaBlast (−2)
    const fmap2: Map<string, FunctionEntry> = new Map([
      ['novaBlast', { id: 'novaBlast', func_name: 'novaBlast()', func_type: 'attack', version: '3', range: '2', damage: '4', energy: '4', cost: '—', effects: '' }],
      ['syncBlast', { id: 'syncBlast', func_name: 'syncBlast()', func_type: 'attack', version: '3', range: '2', damage: '4', energy: '4', cost: '—', effects: '' }],
    ]);
    const b = bot({
      version: 3,
      pendingOperations: ['IF', 'IF', 'IF', 'IF'],
      attacks: { v1: [], v2: [], v3: null },
    });
    b.attacks = { v1: [{ functionId: 'novaBlast' }, { functionId: 'syncBlast' }], v2: [], v3: null };
    const enemy = bot({ id: 'e1', playerId: 2, q: 2, r: 0 });
    const prog = buildProgram(b, state({ bots: [b, enemy] }), fmap2, 2, [], seeded(3));
    const atk = prog.operations.find(o => o.primary.type === 'attack');
    expect(atk?.primary.attackFunctionId).toBe('syncBlast');
  });

  it('berserkProtocol (x2 daño, autodaño) se descarta con vida baja', () => {
    const fmap3 = fmapWith({ berserkProtocol: { range: '—', damage: '—', energy: '5' } });
    const weak = bot({
      id: 'm1', life: 3, maxLife: 10, q: 0, r: 0,
      attacks: { v1: [{ functionId: 'berserkProtocol' }], v2: [], v3: null },
      compiledProgram: { operations: [{ kind: 'IF', primary: { type: 'attack', attackFunctionId: 'berserkProtocol' } }] },
    });
    const enemy = bot({ id: 'e1', playerId: 2, q: 1, r: 0 });
    const ctx = runCtx({
      state: state({ bots: [weak, enemy] }), bot: weak, fmap: fmap3,
      runState: { ...initialRunState, botId: 'm1', opIdx: 0, d6: 3, opFace: '>=' },
    });
    // Inútil con vida baja → fuerza FALSE: n > 3 → 6
    expect(choosePickNumber(ctx, [6, 2])).toBe(6);
  });
});

describe('peekMemory → intercept con bloqueo exacto', () => {
  it('con la RAM espiada bloquea contra los valores reales, no solo extremos', () => {
    const fmap = fmapWith({ powerSmash: { range: '1', damage: '2' } });
    const active = bot({
      id: 'a1', playerId: 2, q: 1, r: 0, numbers: [5, 6],
      attacks: { v1: [{ functionId: 'powerSmash' }], v2: [], v3: null },
    });
    const interceptor = bot({ id: 'i1', playerId: 1, q: 0, r: 0, numbers: [4] });
    const base: InterceptCtx = {
      state: state({ bots: [active, interceptor] }),
      interceptor, activeBot: active,
      op: { kind: 'IF', primary: { type: 'attack', attackFunctionId: 'powerSmash' } },
      opFace: '>', level: 2, rand: seeded(3), fmap,
    };
    // Sin peek: v=4 con '>' no es bloqueo universal (n∈1..3 lo satisfarían) → no intercepta
    expect(decideIntercept(base)).toBe(false);
    // Con peek: sabe que su RAM es [5,6] → 4 > 5 y 4 > 6 son falsos → bloqueo garantizado
    const peeked = { ...base, knownEnemyNumbers: [5, 6] };
    expect(decideIntercept(peeked)).toBe(true);
    expect(chooseInterceptNumber(peeked, [4])).toBe(4);
  });
});
