import { describe, expect, it } from 'vitest';
import { deriveMode } from './battle.types';

describe('deriveMode', () => {
  it('pvp con dos humanos o con controllers ausentes (snapshots antiguos)', () => {
    expect(deriveMode({ kind: 'human' }, { kind: 'human' })).toBe('pvp');
    expect(deriveMode(undefined, undefined)).toBe('pvp');
    expect(deriveMode({ kind: 'human' }, undefined)).toBe('pvp');
  });

  it('pvc con exactamente una CPU, en cualquier bando', () => {
    expect(deriveMode({ kind: 'cpu', level: 2 }, { kind: 'human' })).toBe('pvc');
    expect(deriveMode({ kind: 'human' }, { kind: 'cpu', level: 1 })).toBe('pvc');
    expect(deriveMode(undefined, { kind: 'cpu', level: 3 })).toBe('pvc');
  });

  it('cvc con dos CPUs', () => {
    expect(deriveMode({ kind: 'cpu', level: 1 }, { kind: 'cpu', level: 3 })).toBe('cvc');
  });
});
