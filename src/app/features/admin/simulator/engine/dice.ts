import type { Comparator } from '../../../../shared/types/battle.types';
import type { DotColor } from '../../../../shared/components/hex-map/hex-map.types';

const DICE_COLORS: DotColor[] = ['green', 'blue', 'yellow', 'orange', 'red'];

export function rollDadoColores(): DotColor {
  return DICE_COLORS[Math.floor(Math.random() * DICE_COLORS.length)];
}

export function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollDice(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rollD6());
  return out;
}

export type OperationFace = Comparator;

// Dado de operaciones: 6 caras, una por comparador.
// Cada versión de Bot reordena/rebalancea para favorecer comparadores más fáciles
// según sube de versión (V3 tiene más caras "fáciles" como ≤, ≥, ≠).
const V1_FACES: OperationFace[] = ['<', '>', '==', '==', '!=', '!='];
const V2_FACES: OperationFace[] = ['<=', '>=', '<', '>', '==', '!='];
const V3_FACES: OperationFace[] = ['<=', '>=', '!=', '!=', '<=', '>='];

export function rollOperationDie(version: 1 | 2 | 3): OperationFace {
  const faces = version === 1 ? V1_FACES : version === 2 ? V2_FACES : V3_FACES;
  return faces[Math.floor(Math.random() * faces.length)];
}

export function rollDN(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

/** Parses and rolls a damage string: "2", "1d4", "1d6", "1d8", "1d10". Returns 0 for "—". */
export function rollDamageString(s: string | undefined | null): number {
  if (!s || s === '—' || s === '*') return 0;
  const m = /^(\d+)d(\d+)$/.exec(s.trim());
  if (m) {
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    let total = 0;
    for (let i = 0; i < count; i++) total += rollDN(sides);
    return total;
  }
  const flat = parseInt(s.trim(), 10);
  return isNaN(flat) ? 0 : flat;
}

export function evaluate(d6: number, picked: number, cmp: Comparator): boolean {
  switch (cmp) {
    case '<': return d6 < picked;
    case '<=': return d6 <= picked;
    case '>': return d6 > picked;
    case '>=': return d6 >= picked;
    case '==': return d6 === picked;
    case '!=': return d6 !== picked;
  }
}
