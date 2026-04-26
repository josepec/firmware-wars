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
