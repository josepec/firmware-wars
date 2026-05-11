import type {
  BattleBot, BattleEvent, BattleEventKind, BattleState,
  CompiledProgram, OperationKind, PlayerId,
} from '../../../../shared/types/battle.types';
import { rollD6, rollDice, rollOperationDie, evaluate } from './dice';
import { findClosestEnemy, hexDistance } from './pathfinding';

export interface EnergyRoll { chosen: 1 | 2 | 3; dice: number[]; total: number; }

export class BattleEngine {
  constructor(public state: BattleState, public events: BattleEvent[] = []) {}

  private push(kind: BattleEventKind, payload: Record<string, unknown>, botId?: string): BattleEvent {
    const ev: BattleEvent = {
      turn: this.state.turn,
      activation: this.state.currentActivationIdx,
      phase: this.state.phase,
      timestamp: new Date().toISOString(),
      kind,
      botId,
      payload,
    };
    this.events.push(ev);
    return ev;
  }

  getBot(id: string): BattleBot | undefined {
    return this.state.bots.find(b => b.id === id);
  }

  deploy(botId: string, q: number, r: number): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    bot.q = q;
    bot.r = r;
    this.push('deployed', { q, r }, botId);
  }

  setInit(winner: PlayerId, activationOrder: string[]): void {
    this.state.phase = 'init';
    this.state.cpuPriority = winner;
    this.state.activationOrder = activationOrder;
    this.state.currentActivationIdx = 0;
    this.push('init_ppt', { winner, activationOrder });
    if (this.state.turn === 3 || this.state.turn === 5) {
      for (const b of this.state.bots) {
        if (b.destroyed) continue;
        if (b.version < 3) {
          const nv = (b.version + 1) as 1 | 2 | 3;
          b.version = nv;
          this.push('upgrade', { version: nv }, b.id);
        }
      }
    }
  }

  rollBootEnergy(botId: string, chosen: 1 | 2 | 3): EnergyRoll {
    const bot = this.getBot(botId);
    if (!bot) return { chosen, dice: [], total: 0 };
    this.state.phase = 'boot';
    const dice = rollDice(chosen);
    const total = dice.reduce((a, b) => a + b, 0);
    bot.energy = Math.min(bot.maxEnergy, total);
    this.push('boot_energy_rolled', { chosen, dice, total, energy: bot.energy }, botId);
    return { chosen, dice, total };
  }

  rollBootNumbers(botId: string): number[] {
    const bot = this.getBot(botId);
    if (!bot) return [];
    const need = Math.max(0, bot.maxNumbers - bot.numbers.length);
    const rolled = rollDice(need);
    bot.numbers = [...bot.numbers, ...rolled].slice(0, bot.maxNumbers);
    this.push('boot_numbers_rolled', { numbers: bot.numbers, rolled }, botId);
    return bot.numbers;
  }

  rollBootOperations(botId: string): OperationKind[] {
    const bot = this.getBot(botId);
    if (!bot) return [];
    const slots = Math.max(0, bot.maxOperations - bot.bugs);
    const pool: OperationKind[] = ['IF', 'IF_ELSE', 'FOR', 'WHILE', 'TRY_CATCH'];
    const out: OperationKind[] = [];
    let hasLoop = false;
    while (out.length < slots) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if ((pick === 'FOR' || pick === 'WHILE') && hasLoop) continue;
      if (pick === 'FOR' || pick === 'WHILE') hasLoop = true;
      out.push(pick);
    }
    bot.pendingOperations = out;
    this.push('boot_operations_rolled', { operations: out }, botId);
    return out;
  }

  commitCompile(botId: string, program: CompiledProgram): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    this.state.phase = 'compile';
    bot.compiledProgram = program;
    this.push('compile_committed', { program }, botId);
  }

  rollOperation(version: 1 | 2 | 3) {
    const face = rollOperationDie(version);
    const d6 = rollD6();
    return { face, d6 };
  }

  resolveMove(botId: string, toQ: number, toR: number, energyCost: number): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    if (bot.energy < energyCost) {
      const lifeLoss = energyCost - bot.energy;
      bot.life = Math.max(0, bot.life - lifeLoss);
      bot.energy = 0;
      this.push('overload', { lifeLoss, reason: 'move' }, botId);
      if (bot.life <= 0) {
        bot.destroyed = true;
        this.push('destroyed', {}, botId);
      }
      return;
    }
    bot.energy -= energyCost;
    bot.q = toQ;
    bot.r = toR;
    this.push('move', { toQ, toR, energyCost }, botId);
  }

  resolveAttack(
    botId: string,
    targetId: string,
    damage: number,
    energyCost: number,
    functionId: string,
  ): void {
    const bot = this.getBot(botId);
    const target = this.getBot(targetId);
    if (!bot || !target) return;
    if (bot.energy < energyCost) {
      const lifeLoss = energyCost - bot.energy;
      bot.life = Math.max(0, bot.life - lifeLoss);
      bot.energy = 0;
      this.push('overload', { lifeLoss, reason: 'attack' }, botId);
      if (bot.life <= 0) {
        bot.destroyed = true;
        this.push('destroyed', {}, botId);
      }
      return;
    }
    bot.energy -= energyCost;
    const shieldConsumed = Math.min(target.shield, damage);
    const dealt = Math.max(0, damage - shieldConsumed);
    target.shield -= shieldConsumed;
    target.life = Math.max(0, target.life - dealt);
    this.push('attack_hit', { targetId, damage: dealt, shieldConsumed, energyCost, functionId }, botId);
    if (target.life <= 0) {
      target.destroyed = true;
      this.push('destroyed', {}, targetId);
    }
  }

  resolveShield(botId: string, energyCost: number, amount = 1): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    if (bot.energy < energyCost) return;
    bot.energy -= energyCost;
    bot.shield = Math.min(bot.maxShield, bot.shield + amount);
    this.push('shield_up', { energyCost, amount }, botId);
  }

  recordIntercept(interceptorId: string, attackerId: string): void {
    const interceptor = this.getBot(interceptorId);
    if (!interceptor) return;
    interceptor.hasInterceptedThisTurn = true;
    this.push('intercept', { interceptorId, attackerId }, interceptorId);
  }

  addBug(botId: string, count = 1, reason = 'syntax'): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    bot.bugs = Math.min(bot.maxOperations, bot.bugs + count);
    this.push('bug_added', { count, reason }, botId);
  }

  purgeBug(botId: string, count = 1): void {
    const bot = this.getBot(botId);
    if (!bot) return;
    bot.bugs = Math.max(0, bot.bugs - count);
    this.push('bug_purged', { count }, botId);
  }

  endTurn(botId: string): void {
    const bot = this.getBot(botId);
    if (bot) bot.compiledProgram = undefined;
    this.state.phase = 'end';
    this.push('turn_ended', {}, botId);
    this.state.currentActivationIdx++;
    const winner = this.checkVictory();
    if (winner) {
      this.state.status = 'finished';
      this.state.winner = winner;
      this.state.phase = 'finished';
      this.push('victory', { winner });
      return;
    }
    if (this.state.currentActivationIdx >= this.state.activationOrder.length) {
      for (const b of this.state.bots) b.hasInterceptedThisTurn = false;
      this.state.turn++;
      this.state.currentActivationIdx = 0;
      this.push('round_ended', { nextTurn: this.state.turn });
    }
  }

  checkVictory(): PlayerId | null {
    const p1Alive = this.state.bots.some(b => b.playerId === 1 && !b.destroyed);
    const p2Alive = this.state.bots.some(b => b.playerId === 2 && !b.destroyed);
    if (p1Alive && !p2Alive) return 1;
    if (!p1Alive && p2Alive) return 2;
    return null;
  }
}

export { evaluate, rollD6, findClosestEnemy, hexDistance };
