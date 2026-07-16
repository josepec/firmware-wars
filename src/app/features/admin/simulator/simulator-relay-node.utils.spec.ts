import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleState, MapEntity } from '../../../shared/types/battle.types';
import {
  RELAY_NODE_DAMAGE,
  relayNodeDamageEvents,
  relayNodeValidHexes,
  relayNodesOf,
} from './simulator-relay-node.utils';

function bot(over: Partial<BattleBot>): BattleBot {
  return {
    id: 'b1', name: 'Bot', playerId: 1, q: 0, r: 0,
    life: 10, maxLife: 10, energy: 10, maxEnergy: 10, shield: 0, maxShield: 3,
    maxMovement: 3, maxOperations: 4, bugs: 0, numbers: [], destroyed: false,
    ...over,
  } as BattleBot;
}

function node(over: Partial<MapEntity>): MapEntity {
  return { id: 'n1', kind: 'relay_node', q: 0, r: 0, life: 2, ownerId: 'owner', ...over };
}

/** Rejilla de radio 3 en (0,0), todo transitable. */
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
    bots: [], entities: [],
    hexMap: { hexTypes: [{ id: 'floor', name: 'Suelo', color: '#000', borderColor: '#111', properties: {}, builtIn: true }], hexes, deployments: [] },
    ...over,
  } as BattleState;
}

describe('relayNodeDamageEvents — entrar o salir de la corona', () => {
  const n = node({ q: 0, r: 0 });
  const mover = bot({ id: 'm' });
  const s = state({ bots: [mover], entities: [n] });

  it('daña al entrar en la corona desde fuera', () => {
    const evs = relayNodeDamageEvents(s, 'm', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts');
    expect(evs).toHaveLength(1);
    expect(evs[0].kind).toBe('attack_hit');
    expect(evs[0].payload['damage']).toBe(RELAY_NODE_DAMAGE);
    expect(evs[0].payload['sourceFn']).toBe('relayNode');
  });

  it('daña al salir de la corona', () => {
    const evs = relayNodeDamageEvents(s, 'm', { q: 1, r: 0 }, { q: 2, r: 0 }, 'ts');
    expect(evs).toHaveLength(1);
    expect(evs[0].payload['damage']).toBe(RELAY_NODE_DAMAGE);
  });

  it('NO daña al moverse de un hex de la corona a otro', () => {
    expect(relayNodeDamageEvents(s, 'm', { q: 1, r: 0 }, { q: 0, r: 1 }, 'ts')).toEqual([]);
  });

  it('NO daña al moverse fuera de la corona', () => {
    expect(relayNodeDamageEvents(s, 'm', { q: 3, r: 0 }, { q: 2, r: 0 }, 'ts')).toEqual([]);
  });

  it('el atributo del evento apunta al dueño del Nodo como actor', () => {
    const evs = relayNodeDamageEvents(s, 'm', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts');
    expect(evs[0].botId).toBe('owner');
    expect(evs[0].payload['targetId']).toBe('m');
  });
});

describe('relayNodeDamageEvents — casos de las reglas', () => {
  it('un Nodo destruido no produce daño', () => {
    const s = state({ bots: [bot({ id: 'm' })], entities: [node({ life: 0 })] });
    expect(relayNodeDamageEvents(s, 'm', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts')).toEqual([]);
  });

  it('afecta al aliado del dueño', () => {
    const owner = bot({ id: 'owner', playerId: 1, q: 3, r: 0 });
    const ally = bot({ id: 'ally', playerId: 1 });
    const s = state({ bots: [owner, ally], entities: [node({ ownerId: 'owner' })] });
    const evs = relayNodeDamageEvents(s, 'ally', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts');
    expect(evs).toHaveLength(1);
    expect(evs[0].payload['damage']).toBe(RELAY_NODE_DAMAGE);
  });

  it('el escudo absorbe antes que la vida', () => {
    const s = state({ bots: [bot({ id: 'm', shield: 1 })], entities: [node({})] });
    const evs = relayNodeDamageEvents(s, 'm', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts');
    expect(evs[0].payload['shieldConsumed']).toBe(1);
    expect(evs[0].payload['damage']).toBe(1);
  });

  it('dos Nodos cruzados a la vez encadenan daño y destruyen al Bot', () => {
    const s = state({
      bots: [bot({ id: 'm', life: 3 })],
      entities: [node({ id: 'n1', q: 0, r: 0 }), node({ id: 'n2', q: 2, r: 0 })],
    });
    // (1,-2) está fuera de ambas coronas; (1,0) es adyacente a los dos Nodos.
    const evs = relayNodeDamageEvents(s, 'm', { q: 1, r: -2 }, { q: 1, r: 0 }, 'ts');
    expect(evs.map(e => e.kind)).toEqual(['attack_hit', 'attack_hit', 'destroyed']);
    expect(evs[2].payload['sourceFn']).toBe('relayNode');
  });

  it('no daña a un Bot ya destruido', () => {
    const s = state({ bots: [bot({ id: 'm', destroyed: true })], entities: [node({})] });
    expect(relayNodeDamageEvents(s, 'm', { q: 2, r: 0 }, { q: 1, r: 0 }, 'ts')).toEqual([]);
  });
});

describe('relayNodeValidHexes', () => {
  it('acepta rango 1..2 y excluye el propio hex', () => {
    const me = bot({ id: 'm', q: 0, r: 0 });
    const hexes = relayNodeValidHexes(state({ bots: [me] }), me);
    expect(hexes.has('0,0')).toBe(false);
    expect(hexes.has('1,0')).toBe(true);
    expect(hexes.has('2,0')).toBe(true);
    expect(hexes.has('3,0')).toBe(false);
  });

  it('excluye hexes ocupados por Bots o entidades', () => {
    const me = bot({ id: 'm', q: 0, r: 0 });
    const other = bot({ id: 'o', q: 1, r: 0 });
    const s = state({ bots: [me, other], entities: [node({ q: 2, r: 0 })] });
    const hexes = relayNodeValidHexes(s, me);
    expect(hexes.has('1,0')).toBe(false);
    expect(hexes.has('2,0')).toBe(false);
    expect(hexes.has('0,1')).toBe(true);
  });

  it('excluye hexes con Bots destruidos y con Barreras', () => {
    const me = bot({ id: 'm', q: 0, r: 0 });
    const wreck = bot({ id: 'w', q: 1, r: 0, destroyed: true, life: 0 });
    const barrier: MapEntity = { id: 'b', kind: 'barrier', q: 2, r: 0, life: 3, ownerId: 'x' };
    const hexes = relayNodeValidHexes(state({ bots: [me, wreck], entities: [barrier] }), me);
    expect(hexes.has('1,0')).toBe(false);
    expect(hexes.has('2,0')).toBe(false);
  });

  it('excluye hexes no transitables', () => {
    const me = bot({ id: 'm', q: 0, r: 0 });
    const s = state({ bots: [me] });
    s.hexMap.hexTypes.push({ id: 'wall', name: 'Muro', color: '#000', borderColor: '#111', properties: { traversable: 'false' }, builtIn: true });
    s.hexMap.hexes.find(h => h.q === 1 && h.r === 0)!.typeId = 'wall';
    expect(relayNodeValidHexes(s, me).has('1,0')).toBe(false);
  });
});

describe('relayNodesOf', () => {
  it('cuenta sólo los Nodos del Bot indicado', () => {
    const entities = [
      node({ id: 'a', ownerId: 'b1' }),
      node({ id: 'b', ownerId: 'b1' }),
      node({ id: 'c', ownerId: 'b2' }),
      { id: 'wall', kind: 'barrier', q: 5, r: 0, life: 3, ownerId: 'b1' } as MapEntity,
    ];
    expect(relayNodesOf(entities, 'b1')).toHaveLength(2);
    expect(relayNodesOf(entities, 'b2')).toHaveLength(1);
  });
});
