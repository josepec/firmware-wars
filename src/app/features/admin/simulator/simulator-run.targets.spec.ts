import { describe, expect, it } from 'vitest';
import { computeAttackTargets } from './simulator-run.utils';
import type { BattleBot, FunctionCall } from '../../../shared/types/battle.types';
import type { HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import type { FunctionEntry } from './simulator-bot-card';

/** Mapa llano de 9×9, con los obstáculos que se indiquen. */
function mapa(obstaculos: [number, number][] = []): HexMapData {
  const hexes = [];
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      const esObst = obstaculos.some(([oq, or_]) => oq === q && or_ === r);
      hexes.push({ q, r, typeId: esObst ? 'obstacle' : 'normal' });
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

function bot(id: string, q: number, r: number, playerId: number): BattleBot {
  return { id, q, r, playerId, life: 10, shield: 0, destroyed: false } as unknown as BattleBot;
}

/** gravityWell: rango 3-4, área R(2). */
const fmap = new Map<string, FunctionEntry>([
  ['gravityWell', { range: '3-4 (R(2))', energy: '5', damage: '1d6' } as unknown as FunctionEntry],
]);
const fn = { type: 'attack', attackFunctionId: 'gravityWell' } as FunctionCall;

describe('objetivos de un ataque con impacto en Hex vacío', () => {
  it('incluye Hexes vacíos dentro del rango', () => {
    const atacante = bot('atk', 0, 0, 1);
    const targets = computeAttackTargets(atacante, fn, [atacante], mapa(), fmap, []);
    expect(targets.size).toBeGreaterThan(0);
    // 3,0 está a distancia 3: dentro del rango mínimo
    expect(targets.has('3,0')).toBe(true);
  });

  it('NO permite elegir un Hex de obstáculo', () => {
    const atacante = bot('atk', 0, 0, 1);
    const targets = computeAttackTargets(atacante, fn, [atacante], mapa([[3, 0]]), fmap, []);
    expect(targets.has('3,0')).toBe(false);
  });

  it('respeta el rango mínimo', () => {
    const atacante = bot('atk', 0, 0, 1);
    const targets = computeAttackTargets(atacante, fn, [atacante], mapa(), fmap, []);
    expect(targets.has('1,0')).toBe(false);   // distancia 1 < mínimo 3
    expect(targets.has('2,0')).toBe(false);   // distancia 2 < mínimo 3
  });

  it('excluye lo que queda fuera del rango máximo', () => {
    const atacante = bot('atk', 0, 0, 1);
    const targets = computeAttackTargets(atacante, fn, [atacante], mapa(), fmap, []);
    for (const k of targets) {
      const [q, r] = k.split(',').map(Number);
      const d = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      expect(d).toBeLessThanOrEqual(4);
      expect(d).toBeGreaterThanOrEqual(3);
    }
  });
});
