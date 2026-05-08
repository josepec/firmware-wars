import type { BattleBot, BattleEvent, BattleState, MapEntity, PlayerId, StatusEffect, StatusEffectKind, TempBuff, TempBuffKind } from '../../../../shared/types/battle.types';

function cloneState(s: BattleState): BattleState {
  return {
    ...s,
    debug: s.debug,
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
      statusEffects: [...(b.statusEffects ?? [])],
      tempBuffs: [...(b.tempBuffs ?? [])],
    })),
    hexMap: s.hexMap,
    entities: (s.entities ?? []).map(e => ({ ...e })),
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
        if (v) {
          bot.version = v;
          const maxNumbersByVersion: Record<1 | 2 | 3, number> = { 1: 5, 2: 7, 3: 8 };
          bot.maxNumbers = maxNumbersByVersion[v];
        }
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
    case 'moved': {
      if (bot) {
        const toQ = p['toQ'] as number;
        const toR = p['toR'] as number;
        if (typeof toQ === 'number' && typeof toR === 'number') {
          bot.q = toQ;
          bot.r = toR;
        }
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
      if (bot && !(bot.statusEffects ?? []).some(s => s.kind === 'SAFE_MODE')) {
        bot.bugs += (p['count'] as number) ?? 1;
      }
      break;
    }
    case 'bug_purged': {
      if (bot) bot.bugs = Math.max(0, bot.bugs - ((p['count'] as number) ?? 1));
      break;
    }
    case 'intercept': {
      const interceptorId = p['interceptorId'] as string | undefined;
      const skipped = p['skipped'] as boolean | undefined;
      const interceptor = findBot(state, interceptorId);
      if (interceptor && !skipped) {
        interceptor.hasInterceptedThisTurn = true;
        const n = p['substituteD6'] as number | undefined;
        if (typeof n === 'number') {
          const idx = interceptor.numbers.indexOf(n);
          if (idx >= 0) interceptor.numbers.splice(idx, 1);
        }
      }
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
      if (bot && p['reason'] === 'reboot-skip') {
        bot.statusEffects = (bot.statusEffects ?? []).filter(s => s.kind !== 'REBOOTING');
      }
      state.currentActivationIdx = Math.min(
        state.activationOrder.length,
        state.currentActivationIdx + 1,
      );
      break;
    }
    case 'round_ended': {
      state.currentActivationIdx = 0;
      for (const b of state.bots) {
        b.hasInterceptedThisTurn = false;
        b.statusEffects = (b.statusEffects ?? []).filter(s => s.kind === 'REBOOTING');
      }
      break;
    }
    case 'victory': {
      state.status = 'finished';
      state.winner = p['winner'] as PlayerId | undefined;
      state.phase = 'finished';
      break;
    }
    case 'operation_resolved': {
      const picked = p['picked'] as number | undefined;
      if (typeof picked === 'number' && bot) {
        const idx = bot.numbers.indexOf(picked);
        if (idx >= 0) bot.numbers.splice(idx, 1);
      }
      break;
    }
    case 'debug_action': {
      if (bot) {
        const action = p['action'] as string | undefined;
        if (action === 'reboot') {
          bot.energy = 0;
          bot.numbers = [];
          bot.bugs = 0;
          const others = (bot.statusEffects ?? []).filter(s => s.kind !== 'REBOOTING');
          bot.statusEffects = [...others, { kind: 'REBOOTING', appliedTurn: state.turn }];
        } else {
          const cost = (p['energyCost'] as number) ?? 0;
          bot.energy = Math.max(0, bot.energy - cost);
          const bugsRemoved = (p['bugsRemoved'] as number) ?? 0;
          if (bugsRemoved) bot.bugs = Math.max(0, bot.bugs - bugsRemoved);
          const numbersRemoved = (p['numbersRemoved'] as number) ?? 0;
          if (numbersRemoved > 0) bot.numbers = bot.numbers.slice(0, Math.max(0, bot.numbers.length - numbersRemoved));
        }
      }
      break;
    }
    case 'healed': {
      if (bot) {
        const amount = (p['amount'] as number) ?? 0;
        bot.life = Math.min(bot.maxLife, bot.life + amount);
      }
      break;
    }
    case 'status_applied': {
      if (bot) {
        const kind = p['kind'] as StatusEffectKind | undefined;
        if (kind) {
          const others = (bot.statusEffects ?? []).filter(s => s.kind !== kind);
          bot.statusEffects = [...others, { kind, appliedTurn: state.turn }];
        }
      }
      break;
    }
    case 'status_expired': {
      if (bot) {
        const kind = p['kind'] as StatusEffectKind | undefined;
        if (kind) {
          bot.statusEffects = (bot.statusEffects ?? []).filter(s => s.kind !== kind);
        }
      }
      break;
    }
    case 'buff_applied': {
      if (bot) {
        const kind = p['kind'] as TempBuffKind | undefined;
        if (kind) {
          bot.tempBuffs = [...(bot.tempBuffs ?? []), { kind, appliedTurn: state.turn }];
        }
      }
      break;
    }
    case 'buff_consumed': {
      if (bot) {
        const kind = p['kind'] as TempBuffKind | undefined;
        if (kind) {
          const idx = (bot.tempBuffs ?? []).findIndex(b => b.kind === kind);
          if (idx >= 0) {
            const next = [...(bot.tempBuffs ?? [])];
            next.splice(idx, 1);
            bot.tempBuffs = next;
          }
        }
      }
      break;
    }
    case 'numbers_lost': {
      if (bot) {
        const count = (p['count'] as number) ?? 1;
        bot.numbers = bot.numbers.slice(0, Math.max(0, bot.numbers.length - count));
      }
      break;
    }
    case 'entity_placed': {
      const entity = p['entity'] as MapEntity | undefined;
      if (entity) state.entities = [...(state.entities ?? []), entity];
      break;
    }
    case 'entity_destroyed': {
      const entityId = p['entityId'] as string | undefined;
      if (entityId) state.entities = (state.entities ?? []).filter(e => e.id !== entityId);
      break;
    }
    case 'debug_enabled': {
      state.debug = true;
      break;
    }
    case 'debug_override': {
      const target = p['target'] as 'bot' | 'state' | undefined;
      const patch = p['patch'] as Record<string, unknown> | undefined;
      if (!patch) break;
      if (target === 'bot' && bot) {
        applyBotPatch(bot, patch);
      } else if (target === 'state') {
        applyStatePatch(state, patch);
      }
      break;
    }
    case 'debug_dice_forced':
      // Marcador para el log: el override real ocurre en memoria al consumir el dado.
      break;
    case 'status_resisted':
    case 'criterion_chosen':
    case 'ppt_rolled':
    case 'ppt_tie':
    case 'ppt_starter_set':
    case 'color_rolled':
    case 'phase_changed':
      break;
  }
}

/** Aplica un patch genérico a un bot (solo campos seguros / mutables). */
function applyBotPatch(bot: BattleBot, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case 'life': if (typeof value === 'number') bot.life = clamp(value, 0, bot.maxLife); break;
      case 'energy': if (typeof value === 'number') bot.energy = clamp(value, 0, bot.maxEnergy); break;
      case 'shield': if (typeof value === 'number') bot.shield = clamp(value, 0, bot.maxShield); break;
      case 'bugs': if (typeof value === 'number') bot.bugs = Math.max(0, value); break;
      case 'numbers': if (Array.isArray(value)) bot.numbers = (value as number[]).slice(0, bot.maxNumbers); break;
      case 'destroyed': if (typeof value === 'boolean') {
        bot.destroyed = value;
        if (!value && bot.life <= 0) bot.life = 1;
      } break;
      case 'q': if (typeof value === 'number') bot.q = value; break;
      case 'r': if (typeof value === 'number') bot.r = value; break;
      case 'version': if (value === 1 || value === 2 || value === 3) {
        bot.version = value;
        const maxNumbersByVersion: Record<1 | 2 | 3, number> = { 1: 5, 2: 7, 3: 8 };
        bot.maxNumbers = maxNumbersByVersion[value];
      } break;
      case 'attacks': if (value && typeof value === 'object') {
        const a = value as BattleBot['attacks'];
        bot.attacks = {
          v1: (a.v1 ?? []).map(x => x ? { ...x } : null),
          v2: (a.v2 ?? []).map(x => x ? { ...x } : null),
          v3: a.v3 ? { ...a.v3 } : null,
        };
      } break;
      case 'statusEffects': if (Array.isArray(value)) {
        bot.statusEffects = (value as StatusEffect[]).map(s => ({ ...s }));
      } break;
      case 'tempBuffs': if (Array.isArray(value)) {
        bot.tempBuffs = (value as TempBuff[]).map(b => ({ ...b }));
      } break;
    }
  }
}

function applyStatePatch(state: BattleState, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case 'currentActivationIdx': if (typeof value === 'number') state.currentActivationIdx = value; break;
      case 'cpuPriority': if (value === 1 || value === 2) state.cpuPriority = value; break;
      case 'turn': if (typeof value === 'number') state.turn = value; break;
      case 'activationOrder': if (Array.isArray(value)) state.activationOrder = [...(value as string[])]; break;
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
