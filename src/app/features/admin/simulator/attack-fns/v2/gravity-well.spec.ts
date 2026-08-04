import { describe, expect, it } from 'vitest';
import { gravityWell } from './gravity-well';
import { empField } from '../v3/emp-field';
import type { AttackResolveContext } from '../attack-fn.types';
import type { BattleBot } from '../../../../../shared/types/battle.types';
import type { HexMapData } from '../../../../../shared/components/hex-map/hex-map.types';

/** Mapa llano de 7×7 sin obstáculos salvo los que se indiquen.
 *  Ojo: el motor mira `typeId` y `properties.traversable`, no `type`. */
function mapa(obstaculos: [number, number][] = []): HexMapData {
  const hexes = [];
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      const esObst = obstaculos.some(([oq, or_]) => oq === q && or_ === r);
      hexes.push({ q, r, typeId: esObst ? 'obstacle' : 'normal' } as never);
    }
  }
  return {
    hexes,
    hexTypes: [
      { id: 'normal', properties: {} },
      { id: 'obstacle', properties: { traversable: 'false' } },
    ],
  } as unknown as HexMapData;
}

function bot(id: string, q: number, r: number, playerId: number, life = 10, shield = 0): BattleBot {
  return { id, q, r, playerId, life, shield, destroyed: false, energy: 10, statusEffects: [] } as unknown as BattleBot;
}

function ctx(over: Partial<AttackResolveContext>): AttackResolveContext {
  return {
    attacker: bot('atk', -3, 0, 1),
    target: null,
    impactQ: 0, impactR: 0,
    bots: [], map: mapa(),
    rangeMin: 1, rangeMax: 5,
    damage: 3, energyCost: 5,
    turn: 1, activation: 0, timestamp: 't',
    rollD: () => 6,
    entities: [],
    ...over,
  } as AttackResolveContext;
}

describe('gravityWell con impacto en Hex vacío', () => {
  it('daña a todos los Bots del área aunque no haya Bot en el centro', () => {
    const a = bot('a', 1, 0, 2);
    const b = bot('b', -1, 0, 2);
    const eventos = gravityWell.onHit!(ctx({ bots: [a, b], impactQ: 0, impactR: 0 }));
    const golpes = eventos.filter(e => e.kind === 'attack_hit');
    expect(golpes.map(g => g.payload['targetId']).sort()).toEqual(['a', 'b']);
  });

  it('no atrae a dos Bots al mismo Hex', () => {
    // a y b están a lados opuestos del centro vacío: ambos serían atraídos a 0,0
    const a = bot('a', 1, 0, 2);
    const b = bot('b', -1, 0, 2);
    const eventos = gravityWell.onHit!(ctx({ bots: [a, b], impactQ: 0, impactR: 0, damage: 1 }));
    const destinos = eventos
      .filter(e => e.kind === 'moved')
      .map(e => `${e.payload['toQ']},${e.payload['toR']}`);
    expect(new Set(destinos).size).toBe(destinos.length);
  });

  it('no atrae hacia un obstáculo', () => {
    const a = bot('a', 2, 0, 2);
    const eventos = gravityWell.onHit!(ctx({
      bots: [a], impactQ: 0, impactR: 0, damage: 1, map: mapa([[1, 0]]),
    }));
    expect(eventos.some(e => e.kind === 'moved')).toBe(false);
  });

  it('no atrae a un Bot destruido por el propio impacto', () => {
    const a = bot('a', 1, 0, 2, 2);           // 2 de vida
    const eventos = gravityWell.onHit!(ctx({ bots: [a], impactQ: 0, impactR: 0, damage: 5 }));
    expect(eventos.some(e => e.kind === 'destroyed')).toBe(true);
    expect(eventos.some(e => e.kind === 'moved')).toBe(false);
  });

  it('con Bot objetivo no le duplica el daño primario', () => {
    const t = bot('t', 1, 0, 2);
    const eventos = gravityWell.onHit!(ctx({ bots: [t], target: t, impactQ: t.q, impactR: t.r }));
    expect(eventos.filter(e => e.payload['targetId'] === 't')).toHaveLength(0);
  });
});

describe('empField con impacto en Hex vacío', () => {
  it('aplica daño y tirada de DMZ a todos los del área', () => {
    const a = bot('a', 1, 0, 2);
    const b = bot('b', 0, 1, 2);
    const eventos = empField.onHit!(ctx({ bots: [a, b], impactQ: 0, impactR: 0, rollD: () => 1 }));
    expect(eventos.filter(e => e.kind === 'attack_hit')).toHaveLength(2);
    expect(eventos.filter(e => e.kind === 'status_applied')).toHaveLength(2);
  });

  it('deja fuera a los Bots más allá del radio', () => {
    const lejos = bot('lejos', 3, 0, 2);
    const eventos = empField.onHit!(ctx({ bots: [lejos], impactQ: 0, impactR: 0 }));
    expect(eventos).toHaveLength(0);
  });
});
