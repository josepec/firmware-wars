import type { BattleBot, BattleEvent, BattleState, PlayerId } from '../../../../shared/types/battle.types';

function cloneState(s: BattleState): BattleState {
  return {
    ...s,
    players: { 1: { ...s.players[1] }, 2: { ...s.players[2] } },
    bots: s.bots.map(b => ({
      ...b,
      numbers: [...b.numbers],
      pendingOperations: [...b.pendingOperations],
      attacks: {
        v1: b.attacks.v1.map(a => (a ? { ...a } : null)),
        v2: b.attacks.v2.map(a => (a ? { ...a } : null)),
        v3: b.attacks.v3 ? { ...b.attacks.v3 } : null,
      },
      compiledProgram: b.compiledProgram
        ? { operations: b.compiledProgram.operations.map(o => ({ ...o })) }
        : undefined,
    })),
    hexMap: s.hexMap,
  };
}

function findBot(state: BattleState, id: string | undefined): BattleBot | undefined {
  if (!id) return undefined;
  return state.bots.find(b => b.id === id);
}

function applyEvent(state: BattleState, ev: BattleEvent): void {
  state.phase = ev.phase;
  state.turn = ev.turn;
  const bot = findBot(state, ev.botId);
  const p = ev.payload ?? {};

  switch (ev.kind) {
    case 'deployed': {
      if (bot) {
        const q = p['q'] as number;
        const r = p['r'] as number;
        if (typeof q === 'number' && typeof r === 'number') {
          bot.q = q;
          bot.r = r;
        }
      }
      break;
    }
    case 'init_ppt': {
      const winner = p['winner'] as PlayerId | undefined;
      const order = p['activationOrder'] as string[] | undefined;
      if (winner) state.cpuPriority = winner;
      if (order) {
        state.activationOrder = order;
        state.currentActivationIdx = 0;
      }
      break;
    }
    case 'upgrade': {
      if (bot) {
        const v = p['version'] as 1 | 2 | 3;
        if (v) bot.version = v;
      }
      break;
    }
    case 'boot_energy_rolled': {
      if (bot) {
        const e = p['energy'] as number;
        if (typeof e === 'number') bot.energy = Math.min(bot.maxEnergy, e);
      }
      break;
    }
    case 'boot_numbers_rolled': {
      if (bot) {
        const nums = p['numbers'] as number[] | undefined;
        if (nums) bot.numbers = [...nums];
      }
      break;
    }
    case 'boot_operations_rolled': {
      if (bot) {
        const ops = p['operations'] as BattleBot['pendingOperations'] | undefined;
        if (ops) bot.pendingOperations = [...ops];
      }
      break;
    }
    case 'compile_committed': {
      if (bot) {
        const prog = p['program'] as BattleBot['compiledProgram'];
        if (prog) bot.compiledProgram = { operations: prog.operations.map(o => ({ ...o })) };
      }
      break;
    }
    case 'move': {
      if (bot) {
        const q = p['toQ'] as number;
        const r = p['toR'] as number;
        const cost = (p['energyCost'] as number) ?? 0;
        if (typeof q === 'number' && typeof r === 'number') {
          bot.q = q;
          bot.r = r;
        }
        bot.energy = Math.max(0, bot.energy - cost);
      }
      break;
    }
    case 'attack_hit': {
      const targetId = p['targetId'] as string | undefined;
      const target = findBot(state, targetId);
      const damage = (p['damage'] as number) ?? 0;
      const shieldConsumed = (p['shieldConsumed'] as number) ?? 0;
      const cost = (p['energyCost'] as number) ?? 0;
      if (bot) bot.energy = Math.max(0, bot.energy - cost);
      if (target) {
        target.shield = Math.max(0, target.shield - shieldConsumed);
        target.life = Math.max(0, target.life - damage);
        if (target.life <= 0) target.destroyed = true;
      }
      break;
    }
    case 'attack_miss': {
      if (bot) {
        const cost = (p['energyCost'] as number) ?? 0;
        bot.energy = Math.max(0, bot.energy - cost);
      }
      break;
    }
    case 'shield_up': {
      if (bot) {
        const cost = (p['energyCost'] as number) ?? 0;
        const amount = (p['amount'] as number) ?? 1;
        bot.shield = Math.min(bot.maxShield, bot.shield + amount);
        bot.energy = Math.max(0, bot.energy - cost);
      }
      break;
    }
    case 'overload': {
      if (bot) {
        const lifeLoss = (p['lifeLoss'] as number) ?? 0;
        bot.life = Math.max(0, bot.life - lifeLoss);
        bot.energy = 0;
        if (bot.life <= 0) bot.destroyed = true;
      }
      break;
    }
    case 'bug_added': {
      if (bot) bot.bugs += (p['count'] as number) ?? 1;
      break;
    }
    case 'bug_purged': {
      if (bot) bot.bugs = Math.max(0, bot.bugs - ((p['count'] as number) ?? 1));
      break;
    }
    case 'intercept': {
      const interceptorId = p['interceptorId'] as string | undefined;
      const interceptor = findBot(state, interceptorId);
      if (interceptor) interceptor.hasInterceptedThisTurn = true;
      break;
    }
    case 'destroyed': {
      if (bot) {
        bot.destroyed = true;
        bot.life = 0;
      }
      break;
    }
    case 'turn_ended': {
      state.currentActivationIdx = Math.min(
        state.activationOrder.length,
        state.currentActivationIdx + 1,
      );
      break;
    }
    case 'round_ended': {
      state.currentActivationIdx = 0;
      for (const b of state.bots) b.hasInterceptedThisTurn = false;
      break;
    }
    case 'victory': {
      state.status = 'finished';
      state.winner = p['winner'] as PlayerId | undefined;
      state.phase = 'finished';
      break;
    }
    case 'operation_resolved':
    case 'debug_action':
    case 'criterion_chosen':
    case 'ppt_rolled':
    case 'ppt_starter_set':
    case 'color_rolled':
      break;
  }
}

export function replayTo(
  initialSnapshot: BattleState,
  events: BattleEvent[],
  index: number,
): BattleState {
  const state = cloneState(initialSnapshot);
  const upTo = Math.max(0, Math.min(events.length, index));
  for (let i = 0; i < upTo; i++) applyEvent(state, events[i]);
  return state;
}
