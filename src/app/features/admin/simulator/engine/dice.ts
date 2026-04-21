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

export interface OperationFace {
  comparator: Comparator;
  threshold: number;
}

const V1_FACES: OperationFace[] = [
  { comparator: '==', threshold: 3 },
  { comparator: '==', threshold: 4 },
  { comparator: '<', threshold: 3 },
  { comparator: '>', threshold: 4 },
  { comparator: '!=', threshold: 3 },
  { comparator: '!=', threshold: 4 },
];

const V2_FACES: OperationFace[] = [
  { comparator: '<=', threshold: 2 },
  { comparator: '<=', threshold: 3 },
  { comparator: '>=', threshold: 4 },
  { comparator: '>=', threshold: 5 },
  { comparator: '!=', threshold: 3 },
  { comparator: '!=', threshold: 4 },
];

const V3_FACES: OperationFace[] = [
  { comparator: '<=', threshold: 3 },
  { comparator: '<=', threshold: 4 },
  { comparator: '>=', threshold: 3 },
  { comparator: '>=', threshold: 4 },
  { comparator: '!=', threshold: 2 },
  { comparator: '!=', threshold: 5 },
];

export function rollOperationDie(version: 1 | 2 | 3): OperationFace {
  const faces = version === 1 ? V1_FACES : version === 2 ? V2_FACES : V3_FACES;
  return faces[Math.floor(Math.random() * faces.length)];
}

export function evaluate(n: number, face: OperationFace): boolean {
  switch (face.comparator) {
    case '<': return n < face.threshold;
    case '<=': return n <= face.threshold;
    case '>': return n > face.threshold;
    case '>=': return n >= face.threshold;
    case '==': return n === face.threshold;
    case '!=': return n !== face.threshold;
  }
}
