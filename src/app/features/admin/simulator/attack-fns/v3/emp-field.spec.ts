import { describe, expect, it } from 'vitest';
import type { BattleBot, BattleEvent } from '../../../../../shared/types/battle.types';
import type { AttackResolveContext } from '../attack-fn.types';
import { empField } from './emp-field';

function bot(over: Partial<BattleBot>): BattleBot {
  return {
    id: 'b', name: 'Bot', playerId: 1, q: 0, r: 0,
    life: 10, maxLife: 10, energy: 10, maxEnergy: 10, shield: 0, maxShield: 3,
    maxMovement: 3, maxOperations: 4, bugs: 0, numbers: [], destroyed: false,
    ...over,
  } as BattleBot;
}

/** `rolls` se consume en orden, así fijamos cada tirada. */
function ctx(bots: BattleBot[], attacker: BattleBot, target: BattleBot, rolls: number[]): AttackResolveContext {
  let i = 0;
  return {
    attacker, target, bots,
    map: { hexTypes: [], hexes: [], deployments: [] },
    rangeMin: 2, rangeMax: 5, damage: 0, energyCost: 6,
    turn: 1, activation: 0, timestamp: 'ts',
    rollD: () => rolls[i++] ?? 1,
  } as AttackResolveContext;
}

const dmzOf = (evs: BattleEvent[], id: string) =>
  evs.find(e => e.botId === id && (e.kind === 'status_applied' || e.kind === 'status_resisted'));

describe('empField — alcance del daño y de la tirada de DMZ', () => {
  const attacker = bot({ id: 'atk', playerId: 1, q: 9, r: 0 });
  const target = bot({ id: 'tgt', playerId: 2, q: 0, r: 0 });
  const near = bot({ id: 'near', playerId: 2, q: 1, r: 0 });      // adyacente al impacto
  const ally = bot({ id: 'ally', playerId: 1, q: 0, r: 1 });      // aliado, también adyacente
  const far = bot({ id: 'far', playerId: 2, q: 3, r: 0 });        // fuera de R(1)
  const bots = [attacker, target, near, ally, far];

  it('tira DMZ a todos los alcanzados, incluido el objetivo y los aliados', () => {
    const evs = empField.onHit!(ctx(bots, attacker, target, [3, 3, 3, 3, 3, 3]));
    expect(dmzOf(evs, 'tgt')).toBeDefined();
    expect(dmzOf(evs, 'near')).toBeDefined();
    expect(dmzOf(evs, 'ally')).toBeDefined();
  });

  it('no tira DMZ a quien está fuera de R(1) ni al atacante', () => {
    const evs = empField.onHit!(ctx(bots, attacker, target, [3, 3, 3, 3, 3, 3]));
    expect(dmzOf(evs, 'far')).toBeUndefined();
    expect(dmzOf(evs, 'atk')).toBeUndefined();
  });

  it('aplica DMZ con tirada < 4 y lo resiste con ≥ 4', () => {
    // 2 daños secundarios (near, ally) y luego 3 tiradas de DMZ (tgt, near, ally)
    const evs = empField.onHit!(ctx(bots, attacker, target, [1, 1, 3, 4, 6]));
    expect(dmzOf(evs, 'tgt')!.kind).toBe('status_applied');
    expect(dmzOf(evs, 'near')!.kind).toBe('status_resisted');
    expect(dmzOf(evs, 'ally')!.kind).toBe('status_resisted');
  });

  it('SAFE_MODE impide recibir el DMZ y no llega a tirar el dado', () => {
    const safe = bot({
      id: 'safe', playerId: 2, q: 1, r: 0,
      statusEffects: [{ kind: 'SAFE_MODE', appliedTurn: 1 }],
    });
    // Todas las tiradas son 1 (< 4): sin SAFE_MODE recibiría DMZ sí o sí.
    const evs = empField.onHit!(ctx([attacker, target, safe], attacker, target, [1, 1, 1, 1]));
    const ev = dmzOf(evs, 'safe')!;
    expect(ev.kind).toBe('status_resisted');
    expect(ev.payload['blockedBy']).toBe('SAFE_MODE');
    expect(ev.payload['roll']).toBeUndefined();
    // El objetivo sin SAFE_MODE sí lo recibe
    expect(dmzOf(evs, 'tgt')!.kind).toBe('status_applied');
  });

  it('SAFE_MODE no evita el daño, sólo el DMZ', () => {
    const safe = bot({
      id: 'safe', playerId: 2, q: 1, r: 0,
      statusEffects: [{ kind: 'SAFE_MODE', appliedTurn: 1 }],
    });
    const evs = empField.onHit!(ctx([attacker, target, safe], attacker, target, [4, 1, 1]));
    const hit = evs.find(e => e.kind === 'attack_hit' && e.payload['targetId'] === 'safe');
    expect(hit).toBeDefined();
    expect(hit!.payload['damage']).toBe(4);
  });

  it('daña a todos los alcanzados salvo el atacante y los de fuera de R(1)', () => {
    const evs = empField.onHit!(ctx(bots, attacker, target, [2, 2, 3, 3, 3]));
    const hits = evs.filter(e => e.kind === 'attack_hit').map(e => e.payload['targetId']);
    expect(hits).toContain('near');
    expect(hits).toContain('ally');
    expect(hits).not.toContain('far');
    expect(hits).not.toContain('atk');
  });
});
