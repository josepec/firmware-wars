import { effect, signal, type Injector } from '@angular/core';
import type { CpuLevel, PlayerId } from '../../../../shared/types/battle.types';
import {
  cpuLevelOf,
  decisionKey,
  hasHumanPlayer,
  type AiSnapshot,
  type PendingDecision,
  type RandomFn,
} from './ai.types';
import { buildSnapshot, type AiActions, type AiView } from './ai-view';
import { detectPendingDecision } from './ai-decisions';
import { buildObjectives, type AiObjective } from './ai-objectives';
import { chooseCriterion, chooseDeployHex } from './heuristics/ai-deploy.heuristics';
import { chooseBootDice } from './heuristics/ai-boot.heuristics';
import { buildProgram } from './heuristics/ai-compile.heuristics';
import {
  chooseChargedAction,
  chooseMoveHex,
  choosePickNumber,
  chooseSpecialHex,
  chooseTargetHex,
  type RunHeuristicCtx,
} from './heuristics/ai-run.heuristics';
import { chooseInterceptNumber, decideIntercept, type InterceptCtx } from './heuristics/ai-intercept.heuristics';
import { chooseDebugActions } from './heuristics/ai-debug.heuristics';

function parseHexKey(k: string): { q: number; r: number } {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

/** Orquestador de la IA local. Observa las señales del simulador vía un effect;
 *  cuando la decisión pendiente pertenece a un jugador CPU, la agenda con un
 *  pequeño delay, re-valida que el estado no haya cambiado y la ejecuta llamando
 *  a los MISMOS métodos públicos que usaría un humano. Nunca emite transiciones
 *  de fase (eso sigue siendo de los effects del componente) ni trampea dados. */
export class AiController {
  /** Pausa manual (botón Play/Pausa) o automática (error / watchdog). */
  readonly paused = signal(false);
  readonly aiError = signal<string | null>(null);
  /** Jugador CPU "pensando" ahora mismo — para el chip de la UI. */
  readonly thinking = signal<PlayerId | null>(null);

  private busy = false;
  private tickQueued = false;
  private lastKey = '';
  private sameKeyCount = 0;
  private objectives: AiObjective[] | null = null;

  constructor(
    private readonly sim: AiView & AiActions,
    injector: Injector,
    private readonly delayMs = 600,
    private readonly rand: RandomFn = Math.random,
  ) {
    effect(() => {
      // Leer el snapshot dentro del effect registra todas las señales relevantes.
      const snap = buildSnapshot(this.sim);
      if (this.paused()) return;
      if (this.sim.pendingSaves() > 0 || this.sim.animatingPlayers().size > 0) return;
      if (this.sim.saveError()) return;
      const d = detectPendingDecision(snap);
      if (!d || !this.ownsDecision(d, snap)) {
        this.thinking.set(null);
        return;
      }
      this.thinking.set(typeof d.owner === 'number' ? d.owner : null);
      this.queueTick();
    }, { injector });
  }

  togglePause(): void {
    this.paused.update(p => !p);
    if (!this.paused()) {
      this.aiError.set(null);
      this.lastKey = '';
      this.sameKeyCount = 0;
      this.queueTick();
    }
  }

  private ownsDecision(d: PendingDecision, snap: AiSnapshot): boolean {
    if (d.owner === 'shared') return !hasHumanPlayer(snap.state);
    return cpuLevelOf(snap.state, d.owner) !== null;
  }

  private pauseWithError(msg: string): void {
    this.paused.set(true);
    this.aiError.set(msg);
    this.thinking.set(null);
  }

  private queueTick(): void {
    if (this.tickQueued || this.busy) return;
    this.tickQueued = true;
    setTimeout(() => {
      this.tickQueued = false;
      void this.tick();
    }, this.delayMs);
  }

  private async tick(): Promise<void> {
    if (this.busy || this.paused()) return;
    if (this.sim.pendingSaves() > 0 || this.sim.animatingPlayers().size > 0) return;
    if (this.sim.saveError()) return;

    // Re-detección tras el delay: si el estado cambió, el effect re-agendará.
    const snap = buildSnapshot(this.sim);
    const d = detectPendingDecision(snap);
    if (!d || !this.ownsDecision(d, snap)) {
      this.thinking.set(null);
      return;
    }

    // Watchdog: la misma decisión agendada repetidamente sin avance = IA atascada.
    const key = decisionKey(d, snap.seq)
      + `|${snap.runState.opIdx}|${snap.runState.step}|${snap.runState.chargedAccum}|${snap.runState.forRemaining}`;
    if (key === this.lastKey) {
      this.sameKeyCount++;
      if (this.sameKeyCount >= 3) {
        this.pauseWithError(`IA atascada en «${d.kind}» — pausada. Resuelve a mano y reanuda.`);
        return;
      }
    } else {
      this.lastKey = key;
      this.sameKeyCount = 0;
    }

    this.busy = true;
    try {
      await this.dispatch(d, snap);
    } catch (e) {
      this.pauseWithError(`IA error en «${d.kind}»: ${e} — pausada.`);
    } finally {
      this.busy = false;
      // Encadena la siguiente decisión (cvc). Si no queda nada de la CPU, el tick sale solo.
      if (!this.paused()) this.queueTick();
    }
  }

  private levelFor(owner: PlayerId | 'shared', snap: AiSnapshot): CpuLevel {
    if (owner === 'shared') return 1;
    return cpuLevelOf(snap.state, owner) ?? 1;
  }

  private getObjectives(snap: AiSnapshot): AiObjective[] {
    this.objectives ??= buildObjectives(snap.state);
    return this.objectives;
  }

  private runCtx(d: { owner: PlayerId | 'shared' }, snap: AiSnapshot): RunHeuristicCtx {
    return {
      state: snap.state,
      bot: snap.currentRunBot!,
      runState: snap.runState,
      level: this.levelFor(d.owner, snap),
      objectives: this.getObjectives(snap),
      rand: this.rand,
      fmap: this.sim.functionsMap(),
    };
  }

  private interceptCtx(d: { owner: PlayerId | 'shared' }, snap: AiSnapshot): InterceptCtx {
    const activeBot = snap.currentRunBot!;
    return {
      state: snap.state,
      interceptor: snap.interceptBot!,
      activeBot,
      op: activeBot.compiledProgram?.operations[snap.runState.opIdx] ?? null,
      opFace: snap.runState.opFace,
      level: this.levelFor(d.owner, snap),
      rand: this.rand,
      fmap: this.sim.functionsMap(),
    };
  }

  private async dispatch(d: PendingDecision, snap: AiSnapshot): Promise<void> {
    const level = this.levelFor(d.owner, snap);
    switch (d.kind) {
      case 'criterion':
        this.sim.onCriterionPick(d.owner, chooseCriterion(level, this.rand));
        return;
      case 'ppt-roll':
        await (d.context === 'deploy' ? this.sim.rollPpt(d.owner) : this.sim.rollInitPpt(d.owner));
        return;
      case 'ppt-repeat':
        d.context === 'deploy' ? this.sim.repeatPpt() : this.sim.repeatInitPpt();
        return;
      case 'ppt-confirm':
        await (d.context === 'deploy' ? this.sim.confirmDeployResult() : this.sim.confirmInitResult());
        return;
      case 'color-roll':
        this.sim.rollColorDice();
        return;
      case 'deploy-hex': {
        if (d.options.length === 0) return;
        const hex = chooseDeployHex(snap.state, d.owner, d.options, level, this.getObjectives(snap), this.rand);
        await this.sim.onHexClick(parseHexKey(hex));
        return;
      }
      case 'new-round':
        this.sim.startNewRound();
        return;
      case 'boot': {
        const bot = snap.nextBootBot!;
        await this.sim.bootRollFor(d.botId, chooseBootDice(bot, level, this.rand));
        return;
      }
      case 'compile': {
        const bot = snap.nextCompileBot!;
        const program = buildProgram(bot, snap.state, this.sim.functionsMap(), level, this.getObjectives(snap), this.rand);
        await this.sim.onCompileCommit(d.botId, program);
        return;
      }
      case 'resolve-op':
        await this.sim.resolveCurrentOp();
        return;
      case 'pick-number':
        await this.sim.pickNumber(choosePickNumber(this.runCtx(d, snap), d.options));
        return;
      case 'intercept-decide': {
        if (decideIntercept(this.interceptCtx(d, snap))) {
          this.sim.beginIntercept();
        } else {
          await this.sim.skipIntercept();
        }
        return;
      }
      case 'intercept-number': {
        const n = chooseInterceptNumber(this.interceptCtx(d, snap), d.options);
        await this.sim.pickInterceptNumber(n);
        return;
      }
      case 'move-hex': {
        if (d.options.length === 0) return;
        const hex = chooseMoveHex(this.runCtx(d, snap), d.options);
        await this.sim.onHexClick(parseHexKey(hex));
        return;
      }
      case 'target': {
        if (d.options.length === 0) return;
        const hex = chooseTargetHex(this.runCtx(d, snap), d.options);
        await this.sim.onHexClick(parseHexKey(hex));
        return;
      }
      case 'dash-hex':
      case 'shadow-hex':
      case 'barrier-hex':
      case 'relay-hex': {
        if (d.options.length === 0) return;
        const hex = chooseSpecialHex(this.runCtx(d, snap), d.kind, d.options);
        await this.sim.onHexClick(parseHexKey(hex));
        return;
      }
      case 'charged':
        await (chooseChargedAction(this.runCtx(d, snap)) === 'more'
          ? this.sim.chargedRollMore()
          : this.sim.chargedStop());
        return;
      case 'peek-ack':
        await this.sim.acknowledgePeek();
        return;
      case 'advance-op':
        await this.sim.advanceOp();
        return;
      case 'debug-phase': {
        const bot = snap.currentRunBot!;
        for (const action of chooseDebugActions(bot, level, this.rand)) {
          await this.sim.applyDebugFn(action);
        }
        await this.sim.finishBotRun();
        return;
      }
      case 'finish-bot':
        await this.sim.finishBotRun();
        return;
    }
  }
}
