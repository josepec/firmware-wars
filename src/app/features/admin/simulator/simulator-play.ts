import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import { hexToPixel, type DotColor, type HexMapData, type HexMapEntity } from '../../../shared/components/hex-map/hex-map.types';
import { playAttackAnim, playMoveEnergyAnim, playOverloadAnim, playShieldAnim } from './animations/attack-animator';
import { floatingText } from './animations/primitives/floating-text';
import {
  hexKey,
  OPERATION_LABEL,
  type BattleBot,
  type BattleEvent,
  type BattleReport,
  type BattleState,
  type CompiledOperation,
  type CompiledProgram,
  type FunctionCall,
  type PlayerId,
} from '../../../shared/types/battle.types';
import { evaluate, rollD6, rollDadoColores, rollDamageString, rollDN, rollOperationDie, type OperationFace } from './engine/dice';
import { attackableHexes, buildHexIndex, hexDistance, isTraversable, reachableHexes } from './engine/pathfinding';
import { replayTo } from './engine/replay';
import { rollBoot } from './simulator-boot';
import { CompileEditor } from './simulator-compile-editor';
import { SimulatorBotCard, type FunctionEntry } from './simulator-bot-card';
import { SimulatorRunPanel } from './simulator-run-panel';
import { SimulatorDebugPanel } from './simulator-debug-panel';
import {
  computeAttackTargets,
  fnEnergyCost,
  hasStatus,
  initialRunState,
  parseRangeMax,
  parseRangeMin,
  type RunState,
} from './simulator-run.utils';
import { getAttackFn, lrHexes, sldvHexes, type AttackResolveContext } from './attack-fns/index';
import {
  ANIM_KEY,
  ANIM_MS,
  API_URL,
  COLOR_HEX,
  DEPLOY_PERIMETER,
  choiceLabel,
  computeValidDeployHexes,
  phaseLabel,
  pptEmoji,
  pptLabel,
  resolvePpt,
  rollPptDie,
  type CriterionChoice,
  type DeploySubPhase,
  type InitSubPhase,
  type PptContext,
  type PptHand,
} from './simulator-play.utils';

@Component({
  selector: 'app-simulator-play',
  imports: [RouterLink, HexMap, NgTemplateOutlet, JsonPipe, SimulatorBotCard, CompileEditor, SimulatorRunPanel, SimulatorDebugPanel],
  templateUrl: './simulator-play.html',
  styleUrl: './simulator-play.scss',
})
export class SimulatorPlay implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly DEPLOY_PERIMETER = DEPLOY_PERIMETER;

  readonly pptLabel = pptLabel;
  readonly pptEmoji = pptEmoji;
  readonly choiceLabel = choiceLabel;
  readonly phaseLabel = phaseLabel;

  report = signal<BattleReport | null>(null);
  events = signal<BattleEvent[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  finishing = signal(false);
  saveError = signal<string | null>(null);

  animationEnabled = signal(this.loadAnimPref());

  deployStarter = signal<PlayerId | null>(null);
  pendingRoll = signal<DotColor | null>(null);
  rollingColor = signal(false);

  choiceP1 = signal<CriterionChoice | null>(null);
  choiceP2 = signal<CriterionChoice | null>(null);
  pptP1 = signal<PptHand | null>(null);
  pptP2 = signal<PptHand | null>(null);
  rollingPpt = signal<PlayerId | null>(null);

  initStarted = signal(false);
  initPptP1 = signal<PptHand | null>(null);
  initPptP2 = signal<PptHand | null>(null);
  rollingInitPpt = signal<PlayerId | null>(null);

  bootStarted = signal(false);
  bootRollingFor = signal<string | null>(null);
  statusCheckAnim = signal<Array<{ botId: string; botName: string; playerId: PlayerId; rolling: boolean; roll: number; resisted: boolean; statusKind: string }>>([]);
  selfEffectAnim = signal<{ botName: string; playerId: PlayerId; rolling: boolean; kind: 'heal' | 'selfdmg' | 'bugrecoil'; amount: number; extra?: string } | null>(null);
  rollDiceAnim = signal<{ botName: string; playerId: PlayerId; sides: number; rolling: boolean; result: number } | null>(null);
  peekMemoryReveal = signal<{ targetName: string; numbers: number[]; playerId: PlayerId } | null>(null);
  chargedStrikeAnim = signal<{ roll: number; rolling: boolean; accum: number } | null>(null);
  animatingPlayers = signal<ReadonlySet<PlayerId>>(new Set());

  pendingSaves = signal(0);

  readonly hexMapComp = viewChild(HexMap);

  runState = signal<RunState>(initialRunState);
  nextRoundTurn = signal<number>(1);

  functionsMap = signal<Map<string, FunctionEntry>>(new Map());
  selectedBotIdx = signal<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  expandedAttackVersion = signal<Record<string, 1 | 2 | 3 | null>>({});
  manualBotSelectionFor = signal<Set<PlayerId>>(new Set());

  /** Próximas tiradas forzadas (debug). Se consumen al usarlas. */
  forcedRolls = signal<{ d6?: number; d4?: number; opFace?: OperationFace }>({});

  /** ¿La partida actual está marcada como Debug? */
  readonly debugMode = computed(() => this.currentState().debug === true);

  readonly subPhase = computed<DeploySubPhase>(() => {
    if (this.deployStarter()) return 'done';
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (!c1 || !c2) return 'criterion';
    if (!this.pptP1()) return 'ppt-p1';
    if (!this.pptP2()) return 'ppt-p2';
    return 'ppt-result';
  });

  readonly deployComplete = computed(() => {
    const s = this.currentState();
    return s.phase === 'deploy' && s.bots.length > 0 &&
           this.remainingFor(1) + this.remainingFor(2) === 0;
  });

  readonly initSubPhase = computed<InitSubPhase>(() => {
    const phase = this.currentState().phase;
    if (phase !== 'deploy' && phase !== 'end' && phase !== 'init') return 'done';
    if (!this.initStarted()) return 'idle';
    if (!this.initPptP1()) return 'ppt-p1';
    if (!this.initPptP2()) return 'ppt-p2';
    return 'ppt-result';
  });

  readonly currentState = computed<BattleState>(() => {
    const r = this.report();
    if (!r) {
      return {
        id: '', status: 'in_progress', phase: 'deploy', turn: 0,
        activationOrder: [], currentActivationIdx: 0, cpuPriority: 1,
        players: { 1: { alias: '', listId: '' }, 2: { alias: '', listId: '' } },
        bots: [], hexMap: { hexTypes: [], hexes: [], deployments: [] },
      };
    }
    return replayTo(r.initialSnapshot, this.events(), this.events().length);
  });

  readonly displayMap = computed<HexMapData>(() => {
    const s = this.currentState();
    const rs = this.runState(); // leer siempre — garantiza tracking en todas las fases
    const phase = s.phase;
    const selIdx = this.selectedBotIdx();
    const byPlayer = this.botsByPlayer();

    // Bot con el turno activo → aro con ping
    const inBoot = phase === 'boot' || (phase === 'init' && this.bootStarted());
    const turnBotId =
      (phase === 'run' || phase === 'debug')
        ? (rs.botId ?? s.activationOrder[s.currentActivationIdx] ?? null)
        : (phase === 'compile')
          ? (this.nextCompileBot()?.id ?? null)
          : inBoot
            ? (this.nextBootBot()?.id ?? null)
            : null; // deploy, init (PPT), end → ningún bot tiene el turno

    // Bot seleccionado en el panel del jugador activo → opacidad completa
    const activePlayerId = turnBotId
      ? (s.bots.find(b => b.id === turnBotId)?.playerId ?? null)
      : null;
    const panelSelectedId = activePlayerId
      ? (byPlayer[activePlayerId]?.[selIdx[activePlayerId] ?? 0]?.id ?? null)
      : null;
    const selectedIds = new Set<string>(
      [panelSelectedId].filter(Boolean) as string[]
    );

    const deployments = s.bots
      .filter(b => b.q !== -999)
      .map(b => ({
        q: b.q,
        r: b.r,
        type: 'player' as const,
        team: b.playerId,
        label: b.name,
        active: selectedIds.has(b.id),
        turnBot: b.id === turnBotId,
        destroyed: b.destroyed,
        tooltip: `${b.name}\n♥ ${b.life}/${b.maxLife}  ⚡ ${b.energy}/${b.maxEnergy}  🛡️ ${b.shield}/${b.maxShield}`,
      }));
    return { ...s.hexMap, deployments };
  });

  readonly dotOpacity = computed(() =>
    this.currentState().phase === 'deploy' ? 1.0 : 0.12
  );

  readonly displayEntities = computed<HexMapEntity[]>(() => {
    const s = this.currentState();
    return (s.entities ?? []).map(e => ({
      kind: e.kind,
      q: e.q,
      r: e.r,
      teamColor: e.ownerId
        ? (s.bots.find(b => b.id === e.ownerId)?.playerId === 1 ? '#22d3ee' : '#e879f9')
        : undefined,
    }));
  });

  readonly activeDeployer = computed<PlayerId | null>(() => {
    const s = this.currentState();
    if (s.phase !== 'deploy') return null;
    const starter = this.deployStarter();
    if (!starter) return null;
    const other: PlayerId = starter === 1 ? 2 : 1;
    const placed = s.bots.filter(b => b.q !== -999).length;
    const remStarter = this.remainingFor(starter);
    const remOther = this.remainingFor(other);
    if (remStarter + remOther === 0) return null;
    const nextInAlt: PlayerId = placed % 2 === 0 ? starter : other;
    if (nextInAlt === starter && remStarter > 0) return starter;
    if (nextInAlt === other && remOther > 0) return other;
    return remStarter > 0 ? starter : other;
  });

  readonly nextBot = computed<BattleBot | null>(() => {
    const p = this.activeDeployer();
    if (!p) return null;
    return this.currentState().bots.find(b => b.playerId === p && b.q === -999) ?? null;
  });

  readonly selectableHexes = computed<Set<string> | null>(() => {
    const rs = this.runState();
    if (rs.botId && rs.pendingFn) {
      const bot = this.currentState().bots.find(b => b.id === rs.botId);
      if (!bot) return null;
      if (rs.step === 'dash-move') {
        return reachableHexes(bot.q, bot.r, 1, this.currentState().hexMap, this.currentState().bots, bot.id);
      }
      if (rs.step === 'shadow-step') {
        return this.shadowStepValidHexes(bot);
      }
      if (rs.step === 'picking-hex' && rs.pendingFn.type === 'move') {
        const effectiveDist = Math.max(0, bot.maxMovement - (hasStatus(bot, 'LAG') ? 1 : 0));
        const maxByEnergy = Math.min(effectiveDist, bot.energy);
        if (maxByEnergy <= 0) return new Set();
        const reachable = reachableHexes(bot.q, bot.r, maxByEnergy, this.currentState().hexMap, this.currentState().bots, bot.id);
        // Barriers block movement
        for (const e of (this.currentState().entities ?? [])) {
          if (e.kind === 'barrier') reachable.delete(hexKey(e.q, e.r));
        }
        return reachable;
      }
      if (rs.step === 'picking-target' && rs.pendingFn.type === 'attack') {
        return computeAttackTargets(bot, rs.pendingFn, this.currentState().bots, this.currentState().hexMap, this.functionsMap());
      }
    }

    const color = this.pendingRoll();
    if (!color) return null;
    const deployer = this.activeDeployer();
    if (!deployer) return new Set();
    return computeValidDeployHexes(this.currentState(), color, deployer);
  });

  readonly highlightedHexes = computed<Set<string> | null>(() => this.selectableHexes());
  readonly highlightColor = computed<string>(() => {
    const rs = this.runState();
    if (rs.step === 'picking-hex' || rs.step === 'dash-move' || rs.step === 'shadow-step') return '#3b82f6';
    if (rs.step === 'picking-target') return '#ef4444';
    const c = this.pendingRoll();
    return c ? COLOR_HEX[c] : '#3b82f6';
  });

  readonly attackRangeHexes = computed<Set<string> | null>(() => {
    const rs = this.runState();
    if (rs.step !== 'picking-target' || !rs.pendingFn) return null;
    const bot = this.currentState().bots.find(b => b.id === rs.botId);
    if (!bot || rs.pendingFn.type !== 'attack') return null;
    const attackFnDef = getAttackFn(rs.pendingFn.attackFunctionId ?? '');
    const rangeKind = attackFnDef?.rangeKind ?? 'normal';
    if (rangeKind === 'self') return null;
    const entry = rs.pendingFn.attackFunctionId ? this.functionsMap().get(rs.pendingFn.attackFunctionId) : undefined;
    const rangeMin = parseRangeMin(entry?.range);
    const rangeMax = parseRangeMax(entry?.range);
    const s = this.currentState();
    if (rangeKind === 'SLDV') return sldvHexes(bot.q, bot.r, rangeMin, rangeMax, s.hexMap);
    if (rangeKind === 'LR') return lrHexes(bot.q, bot.r, rangeMin, rangeMax, s.hexMap, s.bots);
    const reachable = attackableHexes(bot.q, bot.r, rangeMax, s.hexMap, s.bots);
    if (rangeMin > 1) {
      for (const k of [...reachable]) {
        const [q, r] = k.split(',').map(Number);
        if (hexDistance(bot.q, bot.r, q, r) < rangeMin) reachable.delete(k);
      }
    }
    return reachable.size > 0 ? reachable : null;
  });

  readonly canPickHex = computed(() => {
    if (this.rollingColor()) return false;
    const s = this.selectableHexes();
    return !!s && s.size > 0;
  });

  readonly turnBanner = computed<{ player: PlayerId; alias: string; sub?: string } | null>(() => {
    const r = this.report();
    if (!r) return null;
    const aliasFor = (p: PlayerId) => p === 1 ? r.player1Alias : r.player2Alias;
    const phase = this.currentState().phase;

    if (this.initStarted()) {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return { player: 1, alias: aliasFor(1), sub: `INIT R${this.nextRoundTurn()} · Tira PPT` };
      if (isp === 'ppt-p2') return { player: 2, alias: aliasFor(2), sub: `INIT R${this.nextRoundTurn()} · Tira PPT` };
      return null;
    }

    const bootBot = this.nextBootBot();
    if (bootBot) {
      return { player: bootBot.playerId, alias: aliasFor(bootBot.playerId), sub: `BOOT · ${bootBot.name}` };
    }

    const compileBot = this.nextCompileBot()
      ?? (phase === 'compile' ? this.lastActiveBot() : null);
    if (compileBot) {
      return { player: compileBot.playerId, alias: aliasFor(compileBot.playerId), sub: `COMPILE · ${compileBot.name}` };
    }

    const runBot = this.currentRunBot() ?? this.anticipatedRunBot();
    if (runBot) {
      const sub = phase === 'debug' ? `DEBUG · ${runBot.name}` : `RUN · ${runBot.name}`;
      return { player: runBot.playerId, alias: aliasFor(runBot.playerId), sub };
    }

    if (phase === 'end' || phase === 'init') return null;

    const sp = this.subPhase();
    if (sp === 'criterion') return null;
    if (sp === 'ppt-p1') return { player: 1, alias: aliasFor(1), sub: 'Tira Dado PPT' };
    if (sp === 'ppt-p2') return { player: 2, alias: aliasFor(2), sub: 'Tira Dado PPT' };
    if (sp === 'ppt-result') return null;

    const d = this.activeDeployer();
    if (!d) return null;
    const bot = this.nextBot();
    const sub = bot ? `Despliega ${bot.name}` : 'Despliegue';
    return { player: d, alias: aliasFor(d), sub };
  });

  readonly recentEvents = computed<BattleEvent[]>(() => {
    const evs = this.events();
    return evs.slice(-10).reverse();
  });

  readonly deployPptWinner = computed<PlayerId | null>(() => {
    const a = this.pptP1();
    const b = this.pptP2();
    if (!a || !b) return null;
    return resolvePpt(a, b);
  });

  readonly initPptWinner = computed<PlayerId | null>(() => {
    const a = this.initPptP1();
    const b = this.initPptP2();
    if (!a || !b) return null;
    return resolvePpt(a, b);
  });

  readonly bootedThisTurn = computed<Set<string>>(() => {
    const turn = this.currentState().turn;
    const set = new Set<string>();
    for (const ev of this.events()) {
      if (ev.kind === 'boot_operations_rolled' && ev.turn === turn && ev.botId) {
        set.add(ev.botId);
      }
    }
    return set;
  });

  readonly nextBootBot = computed<BattleBot | null>(() => {
    if (this.initStarted()) return null;
    const s = this.currentState();
    const inBoot = s.phase === 'boot' || (s.phase === 'init' && this.bootStarted());
    if (!inBoot) return null;
    const booted = this.bootedThisTurn();
    for (const id of s.activationOrder) {
      const b = s.bots.find(x => x.id === id);
      if (!b || b.destroyed) continue;
      if (hasStatus(b, 'REBOOTING')) continue;
      if (!booted.has(id)) return b;
    }
    return null;
  });

  readonly bootComplete = computed(() => {
    const s = this.currentState();
    return s.phase === 'boot' && this.nextBootBot() === null;
  });

  readonly compiledThisTurn = computed<Set<string>>(() => {
    const turn = this.currentState().turn;
    const set = new Set<string>();
    for (const ev of this.events()) {
      if (ev.kind === 'compile_committed' && ev.turn === turn && ev.botId) set.add(ev.botId);
    }
    return set;
  });

  readonly nextCompileBot = computed<BattleBot | null>(() => {
    const s = this.currentState();
    if (s.phase !== 'compile') return null;
    const idx = s.currentActivationIdx;
    const slotId = s.activationOrder[idx];
    if (!slotId) return null;
    const slotBot = s.bots.find(b => b.id === slotId);
    if (!slotBot) return null;
    // Rebooted bot: skip COMPILE entirely → null lets the auto-RUN effect fire and skipRebootedBot runs.
    if (hasStatus(slotBot, 'REBOOTING')) return null;
    const playerId = slotBot.playerId;
    // One bot per slot: if any bot compiled at this activation index this turn → null → triggers RUN
    const compiledAtSlot = this.events().some(
      e => e.kind === 'compile_committed' && e.turn === s.turn && e.activation === idx,
    );
    if (compiledAtSlot) return null;
    // Return the selected eligible (not yet compiled this turn) bot for this player
    const compiled = this.compiledThisTurn();
    const selected = this.selectedBotFor(playerId);
    if (selected && !selected.destroyed && !compiled.has(selected.id)) return selected;
    return s.bots.find(b => b.playerId === playerId && !b.destroyed && !compiled.has(b.id)) ?? null;
  });

  readonly currentRunBot = computed<BattleBot | null>(() => {
    const id = this.runState().botId;
    if (!id) return null;
    return this.currentState().bots.find(b => b.id === id) ?? null;
  });

  /** Most recent action's bot in the current turn (compile_committed or turn_ended).
   *  Bridges async network gaps where nextCompileBot()/currentRunBot() are momentarily null
   *  during phase transitions, so isActive/panelState/turnBanner stay on the correct player. */
  readonly lastActiveBot = computed<BattleBot | null>(() => {
    const s = this.currentState();
    const events = this.events();
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.turn !== s.turn) continue;
      if ((e.kind === 'compile_committed' || e.kind === 'turn_ended') && e.botId) {
        return s.bots.find(b => b.id === e.botId) ?? null;
      }
    }
    return null;
  });

  /** Bot that will run next — same lookup as beginRunForActiveBot().
   *  Bridges the gap between phase→'run' (sync) and runState.botId being set (after network save).
   *  Also covers 'end' phase between turn_ended save and runState.set(initialRunState). */
  readonly anticipatedRunBot = computed<BattleBot | null>(() => {
    const s = this.currentState();
    if (s.phase !== 'run' && s.phase !== 'debug' && s.phase !== 'end') return null;
    if (this.runState().botId !== null) return null;
    return this.lastActiveBot();
  });

  readonly currentRunOp = computed<CompiledOperation | null>(() => {
    const bot = this.currentRunBot();
    if (!bot?.compiledProgram) return null;
    return bot.compiledProgram.operations[this.runState().opIdx] ?? null;
  });

  readonly lastBootEvents = computed<BattleEvent[] | null>(() => {
    const rolling = this.bootRollingFor();
    if (rolling) return null;
    const s = this.currentState();
    const booted = this.bootedThisTurn();
    if (booted.size === 0) return null;
    const lastId = [...booted][booted.size - 1];
    const evs = this.events();
    return evs.filter(
      e => e.botId === lastId && e.turn === s.turn &&
        (e.kind === 'boot_energy_rolled' || e.kind === 'boot_numbers_rolled' ||
         e.kind === 'boot_operations_rolled' || (e.kind === 'bug_added' && e.phase === 'boot')),
    );
  });

  readonly botsByPlayer = computed<Record<PlayerId, BattleBot[]>>(() => {
    const bots = this.currentState().bots;
    return {
      1: bots.filter(b => b.playerId === 1),
      2: bots.filter(b => b.playerId === 2),
    };
  });

  /** True after the bot's activation has completed this turn (turn_ended fired). */
  isActivatedThisTurn(botId: string): boolean {
    const turn = this.currentState().turn;
    return this.events().some(
      e => e.botId === botId && e.turn === turn && e.kind === 'turn_ended',
    );
  }

  /** Intercept once-per-round still available — needs numbers to substitute the d6. */
  canBotIntercept(bot: BattleBot): boolean {
    return !bot.destroyed && !bot.hasInterceptedThisTurn && bot.numbers.length > 0;
  }

  selectedBotFor(p: PlayerId): BattleBot | null {
    const list = this.botsByPlayer()[p];
    if (list.length === 0) return null;
    const idx = this.selectedBotIdx()[p];
    return list[Math.max(0, Math.min(list.length - 1, idx))] ?? null;
  }

  totalBotsFor(p: PlayerId): number {
    return this.botsByPlayer()[p].length;
  }

  selectedBotIdxFor(p: PlayerId): number {
    return this.selectedBotIdx()[p];
  }

  expandedVersionFor(botId: string): 1 | 2 | 3 | null {
    return this.expandedAttackVersion()[botId] ?? null;
  }

  onBotPrev(p: PlayerId): void {
    const total = this.botsByPlayer()[p].length;
    if (total <= 1) return;
    const cur = this.selectedBotIdx()[p];
    this.selectedBotIdx.update(s => ({ ...s, [p]: (cur - 1 + total) % total }));
    this.manualBotSelectionFor.update(s => new Set(s).add(p));
  }

  onBotNext(p: PlayerId): void {
    const total = this.botsByPlayer()[p].length;
    if (total <= 1) return;
    const cur = this.selectedBotIdx()[p];
    this.selectedBotIdx.update(s => ({ ...s, [p]: (cur + 1) % total }));
    this.manualBotSelectionFor.update(s => new Set(s).add(p));
  }

  toggleAttackVersion(botId: string, v: 1 | 2 | 3): void {
    this.expandedAttackVersion.update(s => {
      const cur = s[botId] ?? null;
      return { ...s, [botId]: cur === v ? null : v };
    });
  }

  botsAvailableForCompile(p: PlayerId): BattleBot[] {
    const s = this.currentState();
    if (s.phase !== 'compile') return [];
    const compiled = this.compiledThisTurn();
    return s.bots.filter(b => b.playerId === p && !b.destroyed && !compiled.has(b.id));
  }

  selectBotForCompile(p: PlayerId, botId: string): void {
    const list = this.botsByPlayer()[p];
    const idx = list.findIndex(b => b.id === botId);
    if (idx >= 0) {
      this.selectedBotIdx.update(s => ({ ...s, [p]: idx }));
      this.manualBotSelectionFor.update(s => new Set(s).add(p));
    }
  }

  bootResultsFor(botId: string): { energy?: BattleEvent; numbers?: BattleEvent; ops?: BattleEvent; bug?: BattleEvent } {
    const turn = this.currentState().turn;
    const evs = this.events();
    const out: { energy?: BattleEvent; numbers?: BattleEvent; ops?: BattleEvent; bug?: BattleEvent } = {};
    for (const e of evs) {
      if (e.botId !== botId || e.turn !== turn) continue;
      if (e.kind === 'boot_energy_rolled') out.energy = e;
      else if (e.kind === 'boot_numbers_rolled') out.numbers = e;
      else if (e.kind === 'boot_operations_rolled') out.ops = e;
      else if (e.kind === 'bug_added' && e.phase === 'boot') out.bug = e;
    }
    return out;
  }

  constructor() {
    effect(() => {
      const bb = this.nextBootBot();
      if (!bb) return;
      const manual = this.manualBotSelectionFor();
      if (manual.has(bb.playerId)) return;
      const list = this.botsByPlayer()[bb.playerId];
      const idx = list.findIndex(b => b.id === bb.id);
      if (idx >= 0 && this.selectedBotIdx()[bb.playerId] !== idx) {
        this.selectedBotIdx.update(s => ({ ...s, [bb.playerId]: idx }));
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const turn = this.currentState().turn;
      void turn;
      this.manualBotSelectionFor.set(new Set());
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.pendingSaves() > 0) return;
      if (
        this.deployComplete() &&
        !!this.deployStarter() &&
        !this.bootStarted() &&
        !this.initStarted() &&
        this.currentState().phase === 'deploy' &&
        !this.events().some(e => e.kind === 'init_ppt')
      ) {
        this.initStarted.set(true);
      }
    }, { allowSignalWrites: true });

    // Auto-arranque RUN: cuando entramos en phase 'run' y no hay bot activo, inicia
    effect(() => {
      if (this.pendingSaves() > 0) return;
      const s = this.currentState();
      if (s.phase !== 'run') return;
      if (this.runState().botId !== null) return;
      if (s.activationOrder.length === 0) return;
      void this.beginRunForActiveBot();
    }, { allowSignalWrites: true });

    // Auto-transition BOOT → COMPILE (todos los bots booted → primer bot a COMPILE)
    effect(() => {
      if (this.pendingSaves() > 0) return;
      const s = this.currentState();
      if (s.phase !== 'boot') return;
      if (this.nextBootBot() !== null) return;
      // Avoid re-firing: only emit if no compile phase_changed for this turn yet
      const alreadyTransitioned = this.events().some(
        e => e.kind === 'phase_changed' && e.turn === s.turn
          && (e.payload as Record<string, unknown>)['to'] === 'compile',
      );
      if (alreadyTransitioned) return;
      void this.advanceToCompile();
    }, { allowSignalWrites: true });

    // Auto-transition COMPILE → RUN (bot actual ya commit-eó → arranca su RUN)
    effect(() => {
      if (this.pendingSaves() > 0) return;
      const s = this.currentState();
      if (s.phase !== 'compile') return;
      if (this.nextCompileBot() !== null) return;
      // Bot at currentActivationIdx has compiled. Auto-advance to RUN.
      void this.advanceToRun();
    }, { allowSignalWrites: true });

    // Auto-focus en el bot que está corriendo / compilando
    effect(() => {
      const cb = this.nextCompileBot() ?? this.currentRunBot();
      if (!cb) return;
      const manual = this.manualBotSelectionFor();
      if (manual.has(cb.playerId)) return;
      const list = this.botsByPlayer()[cb.playerId];
      const idx = list.findIndex(b => b.id === cb.id);
      if (idx >= 0 && this.selectedBotIdx()[cb.playerId] !== idx) {
        this.selectedBotIdx.update(s => ({ ...s, [cb.playerId]: idx }));
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
    this.loadFunctions();
  }

  private async loadFunctions(): Promise<void> {
    try {
      const resp = await fetch('/assets/data/tables/attack-functions.json');
      if (!resp.ok) return;
      const raw = await resp.json() as Array<{
        'Función': string;
        'V.~': string;
        'Rango~': string;
        'Daño~': string;
        'Energía~': string;
        'Coste~': string;
        'Efectos': string;
      }>;
      const map = new Map<string, FunctionEntry>();
      for (const r of raw) {
        const name = r['Función'].replace(/`/g, '');
        map.set(name, {
          id: name,
          func_name: name,
          func_type: 'attack',
          version: r['V.~'],
          range: r['Rango~'],
          damage: r['Daño~'],
          energy: r['Energía~'],
          cost: r['Coste~'],
          effects: r['Efectos'],
        });
      }
      this.functionsMap.set(map);
    } catch { /* ignore — bot card just won't show attack details */ }
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/battles/${id}`, { headers: this.auth.authHeaders() });
      if (!resp.ok) {
        this.error.set(`API error ${resp.status}`);
      } else {
        const r = (await resp.json()) as BattleReport;
        this.report.set(r);
        this.events.set(r.events ?? []);
        this.restoreUiState(r.events ?? []);
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.loading.set(false);
  }

  private restoreUiState(events: BattleEvent[]): void {
    for (const ev of events) {
      const p = ev.payload ?? {};
      switch (ev.kind) {
        case 'criterion_chosen': {
          const pl = p['player'] as PlayerId;
          const choice = p['choice'] as CriterionChoice;
          if (pl === 1) this.choiceP1.set(choice);
          if (pl === 2) this.choiceP2.set(choice);
          break;
        }
        case 'ppt_rolled': {
          const pl = p['player'] as PlayerId;
          const hand = p['hand'] as PptHand;
          const ctx = p['context'] as PptContext;
          if (ctx === 'deploy') {
            if (pl === 1) this.pptP1.set(hand);
            if (pl === 2) this.pptP2.set(hand);
          } else {
            if (pl === 1) this.initPptP1.set(hand);
            if (pl === 2) this.initPptP2.set(hand);
            this.initStarted.set(true);
            this.nextRoundTurn.set(ev.turn);
          }
          break;
        }
        case 'ppt_starter_set': {
          this.deployStarter.set(p['starter'] as PlayerId);
          break;
        }
        case 'init_ppt': {
          this.nextRoundTurn.set(ev.turn);
          this.initStarted.set(false);
          this.initPptP1.set(null);
          this.initPptP2.set(null);
          this.bootStarted.set(true);
          break;
        }
        case 'boot_energy_rolled': {
          this.bootStarted.set(true);
          break;
        }
      }
    }
  }

  totalFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p).length;
  }

  remainingFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p && b.q === -999).length;
  }

  colorHex(c: DotColor): string { return COLOR_HEX[c]; }

  private loadAnimPref(): boolean {
    try {
      const v = localStorage.getItem(ANIM_KEY);
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  }

  toggleAnimation(on: boolean): void {
    this.animationEnabled.set(on);
    try { localStorage.setItem(ANIM_KEY, String(on)); } catch { /* ignore */ }
  }

  private async animateDelay(): Promise<void> {
    if (!this.animationEnabled()) return;
    await new Promise<void>(res => setTimeout(res, ANIM_MS));
  }

  private readonly MAP_SIZE = 28;

  private async playAnimForAttack(
    attackId: string | undefined,
    attacker: BattleBot,
    target: BattleBot,
    damage: number,
    shieldConsumed: number,
    energyCost: number,
    extraEvents: BattleEvent[],
    rollDResult?: { sides: number; value: number } | null,
  ): Promise<void> {
    if (!this.animationEnabled()) return;
    const g = this.hexMapComp()?.getAnimLayer();
    if (!g) return;
    const s = this.MAP_SIZE;
    const attackerPx = hexToPixel(attacker.q, attacker.r, s);
    const targetPx = hexToPixel(target.q, target.r, s);
    const statusEv = extraEvents.find(e => e.kind === 'status_applied');
    const statusApplied = statusEv?.payload['kind'] as string | undefined;
    const statusRollEv = extraEvents.find(e => e.kind === 'status_applied' || e.kind === 'status_resisted');
    const statusRoll = statusRollEv ? (statusRollEv.payload['roll'] as number | undefined) : undefined;
    const statusResisted = extraEvents.some(e => e.kind === 'status_resisted');
    const healEv = extraEvents.find(e => e.kind === 'healed');
    const healAmount = healEv
      ? Math.min(attacker.maxLife - attacker.life, healEv.payload['amount'] as number)
      : undefined;
    const moveEv = extraEvents.find(e => e.kind === 'moved' && e.botId === target.id);
    const pushMovePx = moveEv
      ? hexToPixel(moveEv.payload['toQ'] as number, moveEv.payload['toR'] as number, s)
      : undefined;
    const secondaryPx = extraEvents
      .filter(e => e.kind === 'attack_hit')
      .map(e => {
        const bot = this.currentState().bots.find(b => b.id === (e.payload['targetId'] as string));
        if (!bot) return null;
        return {
          ...hexToPixel(bot.q, bot.r, s),
          damage: (e.payload['damage'] as number) ?? 0,
          shieldConsumed: (e.payload['shieldConsumed'] as number) ?? 0,
        };
      })
      .filter(Boolean) as { x: number; y: number; damage: number; shieldConsumed: number }[];
    const statusChecks = extraEvents
      .filter(e => (e.kind === 'status_applied' || e.kind === 'status_resisted') && e.payload['roll'] !== undefined)
      .flatMap(e => {
        const bot = this.currentState().bots.find(b => b.id === e.botId);
        if (!bot) return [];
        return [{ bot, roll: e.payload['roll'] as number, resisted: e.kind === 'status_resisted', statusKind: (e.payload['kind'] as string) ?? 'STATUS' }];
      });

    const panelPromise = statusChecks.length > 0
      ? this.playStatusChecksAnim(statusChecks)
      : null;

    const selfHitEv = extraEvents.find(e => e.kind === 'attack_hit' && e.payload['selfInflicted'] === true);
    const recoilBugEv = extraEvents.find(e => e.kind === 'bug_added' && e.payload['recoil'] === true);
    const buffEv = extraEvents.find(e => e.kind === 'buff_applied' && e.botId === attacker.id);
    const selfPromise = healAmount !== undefined
      ? this.playSelfEffectAnim(attacker, 'heal', healAmount)
      : selfHitEv !== undefined
        ? this.playSelfEffectAnim(attacker, 'selfdmg', selfHitEv.payload['damage'] as number, buffEv ? (buffEv.payload['kind'] as string) : undefined)
        : recoilBugEv !== undefined
          ? this.playSelfEffectAnim(attacker, 'bugrecoil', 1)
          : null;

    const dicePromise = rollDResult
      ? this.playRollDiceAnim(attacker, rollDResult.sides, rollDResult.value)
      : null;

    const overheatEv = extraEvents.find(e => e.kind === 'attack_hit' && e.payload['overheat'] === true);
    const overheatPromise = overheatEv
      ? floatingText(g, attackerPx.x - s * 0.3, attackerPx.y + s * 0.35, `-${overheatEv.payload['energyCost']}⚡`, '#fbbf24', s)
      : null;

    const selfDmg = selfHitEv ? (selfHitEv.payload['damage'] as number) ?? 0 : 0;
    const selfDmgPromise = selfHitEv && selfDmg > 0
      ? floatingText(g, attackerPx.x, attackerPx.y - s * 0.35, `-${selfDmg}♥`, '#ef4444', s)
      : null;

    const targetBugBlocked = extraEvents.some(e => e.kind === 'bug_added' && e.botId === target.id)
      && hasStatus(target, 'SAFE_MODE');
    const attackerBugBlocked = extraEvents.some(e => e.kind === 'bug_added' && e.botId === attacker.id)
      && hasStatus(attacker, 'SAFE_MODE');

    await Promise.all([
      playAttackAnim({
        g, attackId: attackId ?? '', attackerPx, targetPx,
        secondaryPx, damage, size: s, statusApplied, statusRoll, statusResisted,
        pushMovePx, healAmount, shieldConsumed, energyCost,
        targetBugBlocked, attackerBugBlocked,
        skipEnergyAnim: (attackId ?? '').replace(/\(\s*\)$/, '') === 'swapProtocol',
      }),
      panelPromise,
      selfPromise,
      dicePromise,
      overheatPromise,
      selfDmgPromise,
    ]);
  }

  private async playSelfEffectAnim(
    attacker: BattleBot,
    kind: 'heal' | 'selfdmg' | 'bugrecoil',
    amount: number,
    extra?: string,
  ): Promise<void> {
    const pid = attacker.playerId;
    this.animatingPlayers.update(s => new Set([...s, pid]));
    this.selfEffectAnim.set({ botName: attacker.name, playerId: pid, rolling: true, kind, amount: 0, extra });
    await new Promise(r => setTimeout(r, 650));
    this.selfEffectAnim.set({ botName: attacker.name, playerId: pid, rolling: false, kind, amount, extra });
    await new Promise(r => setTimeout(r, 2200));
    this.selfEffectAnim.set(null);
    this.animatingPlayers.update(s => { const n = new Set(s); n.delete(pid); return n; });
  }

  private async playRollDiceAnim(bot: BattleBot, sides: number, result: number): Promise<void> {
    const pid = bot.playerId;
    this.animatingPlayers.update(s => new Set([...s, pid]));
    this.rollDiceAnim.set({ botName: bot.name, playerId: pid, sides, rolling: true, result: 0 });
    await new Promise(r => setTimeout(r, 550));
    this.rollDiceAnim.set({ botName: bot.name, playerId: pid, sides, rolling: false, result });
    await new Promise(r => setTimeout(r, 1800));
    this.rollDiceAnim.set(null);
    this.animatingPlayers.update(s => { const n = new Set(s); n.delete(pid); return n; });
  }

  private playBugAnim(bot: BattleBot): void {
    if (!this.animationEnabled()) return;
    if (hasStatus(bot, 'SAFE_MODE')) return;
    const g = this.hexMapComp()?.getAnimLayer();
    if (!g) return;
    const px = hexToPixel(bot.q, bot.r, this.MAP_SIZE);
    floatingText(g, px.x + this.MAP_SIZE * 0.3, px.y - this.MAP_SIZE * 0.4, '+🐛', '#f97316', this.MAP_SIZE);
  }

  private async playStatusChecksAnim(
    checks: Array<{ bot: BattleBot; roll: number; resisted: boolean; statusKind: string }>,
  ): Promise<void> {
    const playerIds = [...new Set(checks.map(c => c.bot.playerId))] as PlayerId[];
    const toEntries = (rolling: boolean) => checks.map(c => ({
      botId: c.bot.id,
      botName: c.bot.name,
      playerId: c.bot.playerId,
      rolling,
      roll: rolling ? 0 : c.roll,
      resisted: rolling ? false : c.resisted,
      statusKind: c.statusKind,
    }));
    this.animatingPlayers.update(s => new Set([...s, ...playerIds]));
    this.statusCheckAnim.set(toEntries(true));
    await new Promise(r => setTimeout(r, 650));
    this.statusCheckAnim.set(toEntries(false));
    await new Promise(r => setTimeout(r, 2200));
    this.statusCheckAnim.set([]);
    this.animatingPlayers.update(s => { const n = new Set(s); playerIds.forEach(p => n.delete(p)); return n; });
  }

  isActive(p: PlayerId): boolean {
    const phase = this.currentState().phase;
    const bootBot = this.nextBootBot();
    if (bootBot) return bootBot.playerId === p;
    if (phase === 'boot') return true;
    if (phase === 'compile') {
      const cb = this.nextCompileBot() ?? this.lastActiveBot();
      return cb ? cb.playerId === p : true;
    }
    if (phase === 'run' || phase === 'debug') {
      const rb = this.currentRunBot() ?? this.anticipatedRunBot();
      if (rb) return rb.playerId === p;
      return true;
    }
    if (phase === 'end') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1;
        if (isp === 'ppt-p2') return p === 2;
        if (isp === 'ppt-result') return true;
      }
      // Brief transition between bots: keep showing the player whose turn just ended
      const rb = this.currentRunBot() ?? this.lastActiveBot();
      if (rb) return rb.playerId === p;
      return true;
    }
    if (this.initStarted() && phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1;
      if (isp === 'ppt-p2') return p === 2;
      if (isp === 'ppt-result') return true;
      return false;
    }
    if (phase === 'init') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1;
        if (isp === 'ppt-p2') return p === 2;
        if (isp === 'ppt-result') return true;
      }
      return true;
    }
    const sp = this.subPhase();
    if (sp === 'criterion') return !this.choiceFor(p);
    if (sp === 'ppt-p1') return p === 1;
    if (sp === 'ppt-p2') return p === 2;
    if (sp === 'ppt-result') return true;
    if (sp === 'done') return this.activeDeployer() === p;
    return false;
  }

  panelState(p: PlayerId): 'active' | 'waiting' | 'hidden' {
    const phase = this.currentState().phase;
    const bootBot = this.nextBootBot();
    if (bootBot) return bootBot.playerId === p ? 'active' : 'waiting';
    if (phase === 'boot') return 'active';
    if (phase === 'compile') {
      const cb = this.nextCompileBot() ?? this.lastActiveBot();
      if (!cb) return 'active';
      return cb.playerId === p ? 'active' : 'waiting';
    }
    if (phase === 'run' || phase === 'debug') {
      const rb = this.currentRunBot() ?? this.anticipatedRunBot();
      if (rb) return rb.playerId === p ? 'active' : 'waiting';
      return 'active';
    }
    if (phase === 'end') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
        if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
        return 'active';
      }
      // Brief transition between bots: keep showing the player whose turn just ended
      const rb = this.currentRunBot() ?? this.lastActiveBot();
      if (rb) return rb.playerId === p ? 'active' : 'waiting';
      return 'active';
    }
    if (this.initStarted() && phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
      if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
      return 'active';
    }
    if (phase === 'init') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
        if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
      }
      return 'active';
    }
    const sp = this.subPhase();
    if (sp === 'criterion') return 'active';
    if (sp === 'ppt-result') return 'active';
    if (sp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
    if (sp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
    const deployer = this.activeDeployer();
    if (!deployer) return 'active';
    return deployer === p ? 'active' : 'waiting';
  }

  readonly mainPhaseLabel = computed(() => {
    const sub = this.subPhaseLabel();
    return sub ? sub.split(' · ')[0] : phaseLabel(this.currentState().phase);
  });

  readonly interceptOpInfo = computed<{ opKind: string; typeLabel: string; fnName: string; comparator: string } | null>(() => {
    const rs = this.runState();
    if (rs.step !== 'intercept-prompt') return null;
    const bot = rs.botId ? this.currentState().bots.find(b => b.id === rs.botId) : null;
    const op = bot?.compiledProgram?.operations[rs.opIdx] ?? null;
    if (!op) return null;
    const opKind = OPERATION_LABEL[op.kind] ?? '';
    // pendingFn is null at intercept-prompt time (evaluated later in pickNumber);
    // use op.primary as the action the rival is about to attempt
    const fn = rs.pendingFn ?? op.primary;
    let typeLabel: string;
    let fnName: string;
    if (fn.type === 'shield') {
      typeLabel = 'SHIELD'; fnName = '';
    } else if (fn.type === 'move') {
      typeLabel = 'MOVE'; fnName = 'move()';
    } else {
      typeLabel = 'ATTACK';
      const entry = fn.attackFunctionId ? this.functionsMap().get(fn.attackFunctionId) : null;
      fnName = entry?.func_name ?? fn.attackFunctionId ?? '?';
    }
    return { opKind, typeLabel, fnName, comparator: rs.opFace ?? '?' };
  });

  subPhaseLabel(): string | null {
    const phase = this.currentState().phase;
    if (this.initStarted()) {
      const isp = this.initSubPhase();
      if (phase === 'end' || phase === 'init') {
        switch (isp) {
          case 'ppt-p1': return `INIT R${this.nextRoundTurn()} · PPT P1`;
          case 'ppt-p2': return `INIT R${this.nextRoundTurn()} · PPT P2`;
          case 'ppt-result': return `INIT R${this.nextRoundTurn()} · Resultado`;
          default: return null;
        }
      }
    }
    const bootBot = this.nextBootBot();
    if (bootBot) return `BOOT · ${bootBot.name} (P${bootBot.playerId})`;
    if (phase === 'boot') return 'BOOT · Completado';
    const compileBot = this.nextCompileBot();
    if (compileBot) return `COMPILE · ${compileBot.name} (P${compileBot.playerId})`;
    if (phase === 'compile') return 'COMPILE · Completado';
    const runBot = this.currentRunBot();
    if (runBot) return phase === 'debug' ? `DEBUG · ${runBot.name} (P${runBot.playerId})` : `RUN · ${runBot.name} (P${runBot.playerId})`;
    if (phase === 'run') return 'RUN';
    if (phase === 'debug') return 'DEBUG';
    if (phase === 'end') {
      return `END · Ronda ${this.currentState().turn}`;
    }
    if (this.initStarted() && phase === 'deploy') {
      switch (this.initSubPhase()) {
        case 'ppt-p1': return 'INIT · Dado PPT · P1';
        case 'ppt-p2': return 'INIT · Dado PPT · P2';
        case 'ppt-result': return 'INIT · PPT · Resultado';
        default: return 'INIT';
      }
    }
    if (phase === 'init') return 'Iniciativa resuelta';
    switch (this.subPhase()) {
      case 'criterion': return 'Criterio de inicio';
      case 'ppt-p1': return 'Dado PPT · P1';
      case 'ppt-p2': return 'Dado PPT · P2';
      case 'ppt-result': return 'PPT · Resultado';
      case 'done': return this.activeDeployer() ? 'Despliegue' : null;
    }
  }

  choiceFor(p: PlayerId): CriterionChoice | null {
    return (p === 1 ? this.choiceP1 : this.choiceP2)();
  }

  pptFor(p: PlayerId): PptHand | null {
    return (p === 1 ? this.pptP1 : this.pptP2)();
  }

  initPptFor(p: PlayerId): PptHand | null {
    return (p === 1 ? this.initPptP1 : this.initPptP2)();
  }

  resetChoice(player: PlayerId): void {
    (player === 1 ? this.choiceP1 : this.choiceP2).set(null);
  }

  async onCriterionPick(player: PlayerId, choice: CriterionChoice): Promise<void> {
    (player === 1 ? this.choiceP1 : this.choiceP2).set(choice);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'criterion_chosen',
      payload: { player, choice },
    }]);
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (c1 && c2) {
      if (c1 === c2 && (c1 === 'junior-1' || c1 === 'junior-2')) {
        const starter: PlayerId = c1 === 'junior-1' ? 1 : 2;
        this.deployStarter.set(starter);
        await this.appendEvents([{
          turn: 0, activation: 0, phase: 'deploy',
          timestamp: new Date().toISOString(),
          kind: 'ppt_starter_set',
          payload: { starter, reason: 'junior-agreement' },
        }]);
      } else {
        await this.appendEvents([{
          turn: 0, activation: 0, phase: 'deploy',
          timestamp: new Date().toISOString(),
          kind: 'phase_changed',
          payload: { reason: 'criteria-differ', c1, c2 },
        }]);
      }
    }
  }

  async rollPpt(player: PlayerId): Promise<void> {
    if (this.pptFor(player)) return;
    this.rollingPpt.set(player);
    await this.animateDelay();
    const hand = rollPptDie();
    this.rollingPpt.set(null);
    (player === 1 ? this.pptP1 : this.pptP2).set(hand);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_rolled',
      payload: { player, hand, context: 'deploy' as PptContext },
    }]);
    const a = this.pptP1();
    const b = this.pptP2();
    if (a && b && resolvePpt(a, b) === null) {
      await this.appendEvents([{
        turn: 0, activation: 0, phase: 'deploy',
        timestamp: new Date().toISOString(),
        kind: 'ppt_tie',
        payload: { hands: { 1: a, 2: b }, context: 'deploy' as PptContext },
      }]);
    }
  }

  repeatPpt(): void {
    this.pptP1.set(null);
    this.pptP2.set(null);
  }

  async confirmDeployResult(): Promise<void> {
    const w = this.deployPptWinner();
    if (w === null) return;
    this.deployStarter.set(w);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_starter_set',
      payload: { starter: w, reason: 'ppt' },
    }]);
  }

  startInit(): void {
    if (!this.deployComplete()) return;
    this.initStarted.set(true);
  }

  async rollInitPpt(player: PlayerId): Promise<void> {
    if (this.initPptFor(player)) return;
    this.rollingInitPpt.set(player);
    await this.animateDelay();
    const hand = rollPptDie();
    this.rollingInitPpt.set(null);
    (player === 1 ? this.initPptP1 : this.initPptP2).set(hand);
    const nextTurn = this.nextRoundTurn();
    await this.appendEvents([{
      turn: nextTurn, activation: 0, phase: 'init',
      timestamp: new Date().toISOString(),
      kind: 'ppt_rolled',
      payload: { player, hand, context: 'init' as PptContext },
    }]);
    const a = this.initPptP1();
    const b = this.initPptP2();
    if (a && b && resolvePpt(a, b) === null) {
      await this.appendEvents([{
        turn: nextTurn, activation: 0, phase: 'init',
        timestamp: new Date().toISOString(),
        kind: 'ppt_tie',
        payload: { hands: { 1: a, 2: b }, context: 'init' as PptContext },
      }]);
    }
  }

  repeatInitPpt(): void {
    this.initPptP1.set(null);
    this.initPptP2.set(null);
  }

  async confirmInitResult(): Promise<void> {
    const w = this.initPptWinner();
    if (w === null) return;
    await this.resolveInit(w);
  }

  private async resolveInit(winner: PlayerId): Promise<void> {
    const nextTurn = this.nextRoundTurn();
    const bots = this.currentState().bots;
    const wBots = bots.filter(b => b.playerId === winner && !b.destroyed).map(b => b.id);
    const lBots = bots.filter(b => b.playerId !== winner && !b.destroyed).map(b => b.id);
    const order: string[] = [];
    const n = Math.max(wBots.length, lBots.length);
    for (let i = 0; i < n; i++) {
      if (i < wBots.length) order.push(wBots[i]);
      if (i < lBots.length) order.push(lBots[i]);
    }
    const ok = await this.appendEvents([{
      turn: nextTurn, activation: 0, phase: 'init',
      timestamp: new Date().toISOString(),
      kind: 'init_ppt',
      payload: { winner, activationOrder: order },
    }]);
    if (!ok) return;

    // Auto-upgrade: round 3 → V1→V2, round 5 → V2→V3
    if (nextTurn === 3 || nextTurn === 5) {
      const targetVersion = (nextTurn === 3 ? 2 : 3) as 2 | 3;
      const fromVersion = targetVersion - 1;
      const upgradeEvs: BattleEvent[] = this.currentState().bots
        .filter(b => !b.destroyed && b.version === fromVersion)
        .map(b => ({
          turn: nextTurn, activation: 0, phase: 'init' as const,
          timestamp: new Date().toISOString(),
          botId: b.id,
          kind: 'upgrade' as const,
          payload: { version: targetVersion },
        }));
      if (upgradeEvs.length > 0) await this.appendEvents(upgradeEvs);
    }

    this.initStarted.set(false);
    this.initPptP1.set(null);
    this.initPptP2.set(null);
    this.bootStarted.set(true);
  }

  startNewRound(): void {
    this.nextRoundTurn.set(this.currentState().turn + 1);
    this.initPptP1.set(null);
    this.initPptP2.set(null);
    this.initStarted.set(true);
  }

  startBoot(): void {
    this.bootStarted.set(true);
  }

  async advanceToCompile(): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: 0, phase: 'compile',
      timestamp: new Date().toISOString(),
      kind: 'phase_changed',
      payload: { from: 'boot', to: 'compile' },
    }]);
  }

  async onCompileCommit(botId: string, program: CompiledProgram): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'compile',
      timestamp: new Date().toISOString(),
      botId,
      kind: 'compile_committed',
      payload: { program },
    }]);
  }

  async skipToDebug(botId: string): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'compile',
      timestamp: new Date().toISOString(),
      botId,
      kind: 'compile_committed',
      payload: { program: { operations: [] } },
    }]);
  }

  async advanceToRun(): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: 0, phase: 'run',
      timestamp: new Date().toISOString(),
      kind: 'phase_changed',
      payload: { from: 'compile', to: 'run' },
    }]);
  }

  // --- RUN phase handlers ---

  async beginRunForActiveBot(): Promise<void> {
    const s = this.currentState();
    if (s.phase !== 'run') return;
    const idx = s.currentActivationIdx;
    // Find the bot that was actually compiled at this activation slot (player may have chosen freely)
    const compileEv = [...this.events()].reverse().find(
      e => e.kind === 'compile_committed' && e.turn === s.turn && e.activation === idx,
    );
    const id = compileEv?.botId ?? s.activationOrder[idx];
    const bot = s.bots.find(b => b.id === id);
    if (!bot || bot.destroyed) {
      this.runState.set({ ...initialRunState, botId: null });
      await this.finishBotRun(id);
      return;
    }
    if (hasStatus(bot, 'REBOOTING')) {
      await this.skipRebootedBot(bot.id);
      return;
    }
    const program = bot.compiledProgram?.operations ?? [];
    if (program.length === 0) {
      this.runState.set({ ...initialRunState, botId: id, step: 'debug' });
      return;
    }
    this.runState.set({ ...initialRunState, botId: id, opIdx: 0, step: 'idle' });
  }

  async resolveCurrentOp(): Promise<void> {
    const op = this.currentRunOp();
    const bot = this.currentRunBot();
    if (!op || !bot) return;
    if (op.kind === 'IF' || op.kind === 'IF_ELSE') return this.resolveIfLike(op, bot);
    if (op.kind === 'FOR') return this.resolveFor(op, bot);
    if (op.kind === 'TRY_CATCH') return this.resolveTryCatch(op, bot);
    if (op.kind === 'WHILE') return this.resolveWhile(op, bot);
  }

  private async skipOp(bot: BattleBot, kind: string): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: new Date().toISOString(), botId: bot.id,
      kind: 'operation_resolved',
      payload: { opIdx: this.runState().opIdx, kind, skipped: true, reason: 'no-numbers' },
    }]);
    this.runState.update(st => ({ ...st, step: 'op-done', lastOpNotice: 'Sin números en RAM — operación saltada' }));
  }

  private async resolveIfLike(op: CompiledOperation, bot: BattleBot): Promise<void> {
    if (bot.numbers.length === 0) { await this.skipOp(bot, op.kind); return; }
    this.runState.update(s => ({ ...s, step: 'rolling', lastOpNotice: null }));
    await this.animateDelay();
    const opFace = this.consumeOpFace(bot.version);
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, opFace, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = this.consumeD6();
    this.runState.update(s => ({ ...s, opFace, d6, step: 'picking-number' }));
  }

  private async resolveWhile(op: CompiledOperation, bot: BattleBot): Promise<void> {
    if (bot.numbers.length === 0) { await this.skipOp(bot, op.kind); return; }
    this.runState.update(s => ({ ...s, step: 'rolling', lastOpNotice: null }));
    await this.animateDelay();
    const opFace = this.consumeOpFace(bot.version);
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, opFace, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = this.consumeD6();
    this.runState.update(s => ({ ...s, opFace, d6, step: 'picking-number' }));
  }

  async pickNumber(n: number): Promise<void> {
    const rs = this.runState();
    const op = this.currentRunOp();
    const bot = this.currentRunBot();
    if (!op || !bot || rs.step !== 'picking-number' || rs.d6 === null) return;
    if (op.kind !== 'FOR' && !rs.opFace) return;

    if (op.kind === 'FOR') {
      // FOR: pickedNumber + d6 → diff
      const diff = Math.abs(rs.d6 - n);
      const s = this.currentState();
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'operation_resolved',
        payload: { opIdx: rs.opIdx, kind: 'FOR', d6: rs.d6, picked: n, diff, primary: op.primary },
      }]);
      if (diff === 0 || diff > 3) {
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'bug_added', payload: { count: 1, reason: 'infinite-loop' },
        }]);
        this.playBugAnim(bot);
        this.runState.update(st => ({ ...st, pickedNumber: n, step: 'op-done', condResult: 0 }));
        return;
      }
      this.runState.update(st => ({
        ...st, pickedNumber: n, forRemaining: diff, branch: 'primary',
        pendingFn: op.primary, condResult: diff, step: 'evaluated',
      }));
      // Trigger first iteration
      await this.executePendingFn();
      return;
    }

    // WHILE
    if (op.kind === 'WHILE') {
      const condResult = evaluate(rs.d6, n, rs.opFace!);
      const s = this.currentState();
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'operation_resolved',
        payload: { opIdx: rs.opIdx, kind: 'WHILE', opFace: rs.opFace, d6: rs.d6, picked: n, condResult, primary: op.primary },
      }]);
      if (condResult) {
        this.runState.update(st => ({
          ...st, pickedNumber: n, condResult, branch: 'primary',
          pendingFn: op.primary, step: 'evaluated', loopExecuted: true,
        }));
        await this.executePendingFn();
      } else {
        if (!rs.loopExecuted) {
          await this.appendEvents([{
            turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
            timestamp: new Date().toISOString(), botId: bot.id,
            kind: 'bug_added', payload: { count: 1, reason: 'while-never-executed' },
          }]);
          this.playBugAnim(bot);
        }
        this.runState.update(st => ({ ...st, pickedNumber: n, condResult, step: 'op-done' }));
      }
      return;
    }

    // IF / IF_ELSE
    const condResult = evaluate(rs.d6, n, rs.opFace!);
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: new Date().toISOString(), botId: bot.id,
      kind: 'operation_resolved',
      payload: { opIdx: rs.opIdx, kind: op.kind, opFace: rs.opFace, d6: rs.d6, picked: n, condResult, primary: op.primary, secondary: op.secondary ?? null },
    }]);
    if (condResult) {
      this.runState.update(st => ({
        ...st, pickedNumber: n, condResult, branch: 'primary',
        pendingFn: op.primary, step: 'evaluated',
      }));
      await this.executePendingFn();
    } else if (op.kind === 'IF_ELSE' && op.secondary) {
      this.runState.update(st => ({
        ...st, pickedNumber: n, condResult, branch: 'secondary',
        pendingFn: op.secondary!, step: 'evaluated',
      }));
      await this.executePendingFn();
    } else {
      this.runState.update(st => ({ ...st, pickedNumber: n, condResult, step: 'op-done' }));
    }
  }

  private async executePendingFn(): Promise<void> {
    const rs = this.runState();
    const fn = rs.pendingFn;
    const bot = this.currentRunBot();
    if (!fn || !bot) return;
    if (fn.type === 'shield') {
      const s = this.currentState();
      const cost = 2;
      if (bot.energy < cost) {
        const lifeLoss = cost - bot.energy;
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'overload', payload: { lifeLoss, reason: 'shield' },
        }]);
        if (bot.life - lifeLoss <= 0) {
          await this.appendEvents([{
            turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
            timestamp: new Date().toISOString(), botId: bot.id,
            kind: 'destroyed', payload: {},
          }]);
        }
      } else {
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'shield_up', payload: { energyCost: cost, amount: 1 },
        }]);
        if (this.animationEnabled()) {
          const g = this.hexMapComp()?.getAnimLayer();
          if (g) {
            const px = hexToPixel(bot.q, bot.r, this.MAP_SIZE);
            const gained = Math.min(1, bot.maxShield - bot.shield);
            playShieldAnim(g, px.x, px.y, gained, cost, this.MAP_SIZE);
          }
        }
      }
      await this.afterFnExecuted();
      return;
    }
    if (fn.type === 'move') {
      if (bot.energy <= 0) {
        await this.applyOverload(bot, 1, 'move');
        await this.afterFnExecuted();
        return;
      }
      this.runState.update(s => ({ ...s, step: 'picking-hex' }));
      return;
    }
    if (fn.type === 'attack') {
      const attackFnDefEval = fn.attackFunctionId ? getAttackFn(fn.attackFunctionId) : undefined;
      if (attackFnDefEval?.id === 'shadowStep') {
        const cost = fnEnergyCost(fn, this.functionsMap(), bot);
        if (bot.energy < cost) {
          await this.applyOverload(bot, cost, 'attack');
          await this.afterFnExecuted();
          return;
        }
        const validHexes = this.shadowStepValidHexes(bot);
        if (validHexes.size === 0) {
          this.runState.update(rs => ({ ...rs, lastOpNotice: 'Sin hexes de teleporte disponibles' }));
          await this.afterFnExecuted();
          return;
        }
        this.runState.update(s => ({ ...s, step: 'shadow-step', lastOpNotice: 'Elige hex de teleporte (radio 3)' }));
        return;
      }
      const targets = computeAttackTargets(bot, fn, this.currentState().bots, this.currentState().hexMap, this.functionsMap());
      if (targets.size === 0) {
        const s = this.currentState();
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'bug_added', payload: { count: 1, reason: 'no-targets-in-range' },
        }]);
        this.runState.update(rs => ({ ...rs, lastOpNotice: 'Sin objetivos en rango — ataque fallido · +1 🐛' }));
        if (this.animationEnabled()) {
          const g = this.hexMapComp()?.getAnimLayer();
          if (g) {
            const px = hexToPixel(bot.q, bot.r, this.MAP_SIZE);
            floatingText(g, px.x - this.MAP_SIZE * 0.2, px.y, 'MISS', '#6b7280', this.MAP_SIZE);
          }
        }
        this.playBugAnim(bot);
        await this.afterFnExecuted();
        return;
      }
      this.runState.update(s => ({ ...s, step: 'picking-target' }));
      return;
    }
  }

  private async applyOverload(bot: BattleBot, requestedCost: number, reason: string): Promise<void> {
    const s = this.currentState();
    const lifeLoss = Math.max(0, requestedCost - bot.energy);
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: new Date().toISOString(), botId: bot.id,
      kind: 'overload', payload: { lifeLoss, reason },
    }]);
    if (bot.life - lifeLoss <= 0) {
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'destroyed', payload: {},
      }]);
    }
    if (this.animationEnabled() && lifeLoss > 0) {
      const g = this.hexMapComp()?.getAnimLayer();
      if (g) {
        const px = hexToPixel(bot.q, bot.r, this.MAP_SIZE);
        playOverloadAnim(g, px.x, px.y, lifeLoss, this.MAP_SIZE);
      }
    }
  }

  async pickRunHex(q: number, r: number): Promise<void> {
    const rs = this.runState();
    const bot = this.currentRunBot();
    const fn = rs.pendingFn;
    if (!bot || !fn || fn.type !== 'move') return;
    const actualDist = hexDistance(bot.q, bot.r, q, r);
    const cost = Math.max(0, actualDist - (hasStatus(bot, 'LAG') ? 1 : 0));
    const s = this.currentState();
    if (bot.energy < cost) {
      await this.applyOverload(bot, cost, 'move');
    } else {
      const preMoveQ = bot.q, preMoveR = bot.r;
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'move', payload: { toQ: q, toR: r, energyCost: cost },
      }]);
      if (this.animationEnabled() && cost > 0) {
        const g = this.hexMapComp()?.getAnimLayer();
        if (g) {
          const px = hexToPixel(preMoveQ, preMoveR, this.MAP_SIZE);
          playMoveEnergyAnim(g, px.x, px.y, cost, this.MAP_SIZE);
        }
      }
      // Relay node damage: triggers when entering or exiting a hex adjacent to a node
      const relayNodes = this.currentState().entities?.filter(e => e.kind === 'relay_node') ?? [];
      if (relayNodes.length > 0) {
        const movedBot = this.currentState().bots.find(b => b.id === bot.id)!;
        const ts2 = new Date().toISOString();
        for (const node of relayNodes) {
          if (hexDistance(bot.q, bot.r, node.q, node.r) > 1 && hexDistance(movedBot.q, movedBot.r, node.q, node.r) > 1) continue;
          if (movedBot.destroyed) break;
          const nodeDmg = 2;
          const sc = Math.min(movedBot.shield, nodeDmg);
          const dealt = nodeDmg - sc;
          const st = this.currentState();
          await this.appendEvents([{
            turn: st.turn, activation: st.currentActivationIdx, phase: 'run',
            timestamp: ts2, botId: node.ownerId,
            kind: 'attack_hit',
            payload: { targetId: movedBot.id, damage: dealt, shieldConsumed: sc, energyCost: 0, sourceFn: 'relayNode' },
          }]);
          if (movedBot.life - dealt <= 0) {
            await this.appendEvents([{
              turn: st.turn, activation: st.currentActivationIdx, phase: 'run',
              timestamp: ts2, botId: movedBot.id, kind: 'destroyed', payload: { sourceFn: 'relayNode' },
            }]);
          }
        }
      }
    }
    await this.afterFnExecuted();
  }

  async pickDashMoveHex(toQ: number, toR: number): Promise<void> {
    const bot = this.currentRunBot();
    if (!bot) return;
    const s = this.currentState();
    const ts = new Date().toISOString();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: ts, botId: bot.id,
      kind: 'moved',
      payload: { fromQ: bot.q, fromR: bot.r, toQ, toR, sourceFn: 'dashStrike' },
    }]);
    this.runState.update(rs => ({ ...rs, step: 'evaluated', lastOpNotice: null }));
    await this.afterFnExecuted();
  }

  private shadowStepValidHexes(bot: BattleBot): Set<string> {
    const s = this.currentState();
    const idx = buildHexIndex(s.hexMap);
    const occupied = new Set(s.bots.filter(b => !b.destroyed && b.id !== bot.id).map(b => hexKey(b.q, b.r)));
    const result = new Set<string>();
    for (const cell of s.hexMap.hexes) {
      const dist = hexDistance(bot.q, bot.r, cell.q, cell.r);
      if (dist === 0 || dist > 3) continue;
      if (!isTraversable(idx.get(hexKey(cell.q, cell.r)), s.hexMap)) continue;
      if (occupied.has(hexKey(cell.q, cell.r))) continue;
      result.add(hexKey(cell.q, cell.r));
    }
    return result;
  }

  async pickShadowStepHex(toQ: number, toR: number): Promise<void> {
    const rs = this.runState();
    const bot = this.currentRunBot();
    const fn = rs.pendingFn;
    if (!bot || !fn) return;
    const s = this.currentState();
    const ts = new Date().toISOString();
    const cost = fnEnergyCost(fn, this.functionsMap(), bot);
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: ts, botId: bot.id,
      kind: 'attack_hit',
      payload: { targetId: bot.id, damage: 0, shieldConsumed: 0, energyCost: cost, sourceFn: 'shadowStep' },
    }, {
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: ts, botId: bot.id,
      kind: 'moved',
      payload: { fromQ: bot.q, fromR: bot.r, toQ, toR, sourceFn: 'shadowStep' },
    }]);
    this.runState.update(rs2 => ({ ...rs2, step: 'evaluated', lastOpNotice: null }));
    await this.afterFnExecuted();
  }

  async pickRunTarget(targetId: string): Promise<void> {
    const rs = this.runState();
    const bot = this.currentRunBot();
    const fn = rs.pendingFn;
    if (!bot || !fn || fn.type !== 'attack') return;
    const s = this.currentState();
    const target = s.bots.find(b => b.id === targetId);
    if (!target) return;
    const entry = fn.attackFunctionId ? this.functionsMap().get(fn.attackFunctionId) : undefined;
    const attackFnDef = getAttackFn(fn.attackFunctionId);
    const cost = attackFnDef?.computeEnergyCost?.(bot) ?? fnEnergyCost(fn, this.functionsMap());
    const ts = new Date().toISOString();

    if (bot.energy < cost) {
      await this.applyOverload(bot, cost, 'attack');
      await this.afterFnExecuted();
      return;
    }

    if (attackFnDef?.id === 'chargedStrike') {
      this.runState.update(s => ({ ...s, step: 'charged-rolling', chargedAccum: 0, chargedTargetId: targetId }));
      this.chargedStrikeAnim.set({ roll: 0, rolling: true, accum: 0 });
      await new Promise(r => setTimeout(r, 500));
      const firstRoll = this.consumeD4();
      if (firstRoll === 1) {
        this.chargedStrikeAnim.set({ roll: 1, rolling: false, accum: 1 });
        await new Promise(r => setTimeout(r, 800));
        this.chargedStrikeAnim.set(null);
        this.runState.update(s => ({ ...s, step: 'evaluated', chargedAccum: 0, chargedTargetId: null }));
        await this.resolveChargedBust(bot, 1, fn, cost, ts);
        return;
      }
      this.runState.update(s => ({ ...s, chargedAccum: firstRoll }));
      this.chargedStrikeAnim.set({ roll: firstRoll, rolling: false, accum: firstRoll });
      return;
    }

    let rollDResult: { sides: number; value: number } | null = null;
    const trackRollD = (sides: number): number => {
      const v = rollDN(sides);
      if (!rollDResult) rollDResult = { sides, value: v };
      return v;
    };
    const ctx: AttackResolveContext = {
      attacker: bot, target, bots: s.bots, map: s.hexMap,
      rangeMin: parseRangeMin(entry?.range),
      rangeMax: parseRangeMax(entry?.range),
      energyCost: cost, turn: s.turn, activation: s.currentActivationIdx,
      timestamp: ts, rollD: trackRollD, splashRadius: attackFnDef?.splashRadius,
      entities: s.entities, damage: 0,
    };
    ctx.damage = attackFnDef?.rollDamage?.(ctx) ?? rollDamageString(entry?.damage);
    const rollDamageBase = ctx.damage;
    ctx.rollD = rollDN; // restore plain rollD so onHit dice don't pollute rollDResult

    // Apply turn-scoped damage status effects (cleared at turn_ended)
    if (hasStatus(bot, 'OVERCLOCK')) ctx.damage += 1;
    if (hasStatus(bot, 'BERSERK')) ctx.damage *= 2;

    const shieldConsumed = Math.min(target.shield, ctx.damage);
    const dealt = Math.max(0, ctx.damage - shieldConsumed);
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: ts, botId: bot.id,
      kind: 'attack_hit',
      payload: { targetId, damage: dealt, shieldConsumed, energyCost: cost, functionId: fn.attackFunctionId, baseDamage: rollDamageBase },
    }]);
    if (target.life - dealt <= 0) {
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: ts, botId: targetId, kind: 'destroyed', payload: {},
      }]);
    }

    const extraEvents = attackFnDef?.onHit?.(ctx) ?? [];
    for (const ev of extraEvents) await this.appendEvents([ev]);

    await this.playAnimForAttack(fn.attackFunctionId, bot, target, dealt, shieldConsumed, cost, extraEvents, rollDResult);

    if (attackFnDef?.freeMove) {
      const freeHexes = reachableHexes(bot.q, bot.r, 1, this.currentState().hexMap, this.currentState().bots, bot.id);
      if (freeHexes.size > 0) {
        this.runState.update(rs => ({ ...rs, step: 'dash-move', lastOpNotice: 'Elige hex de destino (movimiento libre)' }));
        return;
      }
    }
    if (attackFnDef?.id === 'peekMemory') {
      const targetNow = this.currentState().bots.find(b => b.id === target.id);
      this.peekMemoryReveal.set({
        targetName: target.name,
        numbers: [...(targetNow?.numbers ?? target.numbers)],
        playerId: bot.playerId,
      });
      return;
    }
    await this.afterFnExecuted();
  }

  async acknowledgePeek(): Promise<void> {
    this.peekMemoryReveal.set(null);
    await this.afterFnExecuted();
  }

  async chargedRollMore(): Promise<void> {
    const rs = this.runState();
    if (rs.step !== 'charged-rolling' || !rs.chargedTargetId) return;
    const bot = this.currentRunBot()!;
    const fn = rs.pendingFn!;
    const cost = fnEnergyCost(fn, this.functionsMap());
    const ts = new Date().toISOString();

    this.chargedStrikeAnim.set({ roll: 0, rolling: true, accum: rs.chargedAccum });
    await new Promise(r => setTimeout(r, 500));
    const d4 = this.consumeD4();
    const newAccum = rs.chargedAccum + d4;

    if (d4 === 1) {
      this.chargedStrikeAnim.set({ roll: 1, rolling: false, accum: newAccum });
      await new Promise(r => setTimeout(r, 800));
      this.chargedStrikeAnim.set(null);
      this.runState.update(s => ({ ...s, step: 'evaluated', chargedAccum: 0, chargedTargetId: null }));
      await this.resolveChargedBust(bot, newAccum, fn, cost, ts);
      return;
    }

    this.runState.update(s => ({ ...s, chargedAccum: newAccum }));
    this.chargedStrikeAnim.set({ roll: d4, rolling: false, accum: newAccum });
  }

  async chargedStop(): Promise<void> {
    const rs = this.runState();
    if (rs.step !== 'charged-rolling' || !rs.chargedTargetId) return;
    const bot = this.currentRunBot()!;
    const target = this.currentState().bots.find(b => b.id === rs.chargedTargetId)!;
    const fn = rs.pendingFn!;
    const cost = fnEnergyCost(fn, this.functionsMap());
    const accum = rs.chargedAccum;

    this.chargedStrikeAnim.set(null);
    this.runState.update(s => ({ ...s, step: 'evaluated', chargedAccum: 0, chargedTargetId: null }));
    await this.resolveChargedHit(bot, target, accum, fn, cost, new Date().toISOString());
  }

  private async resolveChargedHit(
    bot: BattleBot, target: BattleBot, damage: number,
    fn: FunctionCall, cost: number, ts: string,
  ): Promise<void> {
    const s = this.currentState();
    const shieldConsumed = Math.min(target.shield, damage);
    const dealt = Math.max(0, damage - shieldConsumed);
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run', timestamp: ts,
      botId: bot.id, kind: 'attack_hit',
      payload: { targetId: target.id, damage: dealt, shieldConsumed, energyCost: cost, functionId: fn.attackFunctionId },
    }]);
    if (target.life - dealt <= 0) {
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run', timestamp: ts,
        botId: target.id, kind: 'destroyed', payload: {},
      }]);
    }
    await this.playAnimForAttack(fn.attackFunctionId, bot, target, dealt, shieldConsumed, cost, []);
    await this.afterFnExecuted();
  }

  private async resolveChargedBust(
    bot: BattleBot, totalDamage: number,
    fn: FunctionCall, cost: number, ts: string,
  ): Promise<void> {
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run', timestamp: ts,
      botId: bot.id, kind: 'attack_hit',
      payload: { targetId: bot.id, damage: totalDamage, shieldConsumed: 0, energyCost: cost, functionId: fn.attackFunctionId, selfInflicted: true, chargedBust: true },
    }]);
    if (bot.life - totalDamage <= 0) {
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run', timestamp: ts,
        botId: bot.id, kind: 'destroyed', payload: { sourceFn: 'chargedStrike' },
      }]);
    }
    await this.playSelfEffectAnim(bot, 'selfdmg', totalDamage);
    await this.afterFnExecuted();
  }

  private async afterFnExecuted(): Promise<void> {
    const rs = this.runState();
    // WHILE loop: continue with new condition check each iteration
    const whileOp = this.currentRunOp();
    if (whileOp?.kind === 'WHILE') {
      const bot = this.currentRunBot()!;
      const cost = fnEnergyCost(rs.pendingFn!, this.functionsMap());
      if (bot.energy < cost) {
        await this.applyOverload(bot, cost, 'while-loop-iteration');
        this.runState.update(s => ({ ...s, step: 'op-done', pendingFn: null }));
        return;
      }
      // Si se quedó sin números, el bucle termina
      if (bot.numbers.length === 0) {
        this.runState.update(s => ({ ...s, step: 'op-done', pendingFn: null, lastOpNotice: 'Sin números en RAM — bucle WHILE terminado' }));
        return;
      }
      // New condition check for next iteration
      this.runState.update(s => ({ ...s, step: 'rolling', opFace: null, d6: null, pickedNumber: null, condResult: null, pendingFn: null }));
      await this.animateDelay();
      const opFace = this.consumeOpFace(bot.version);
      const interceptBot = this.findInterceptBot(bot);
      if (interceptBot) {
        this.runState.update(s => ({ ...s, opFace, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
        return;
      }
      const d6 = this.consumeD6();
      this.runState.update(s => ({ ...s, opFace, d6, step: 'picking-number' }));
      return;
    }
    if (rs.forRemaining > 1) {
      // Check energy before next FOR iteration — insufficient → OVERLOAD + stop loop
      const iterBot = this.currentRunBot();
      const iterFn = rs.pendingFn;
      if (iterBot && iterFn) {
        const cost = fnEnergyCost(iterFn, this.functionsMap());
        if (iterBot.energy < cost) {
          await this.applyOverload(iterBot, cost, 'for-loop-iteration');
          this.runState.update(s => ({ ...s, step: 'op-done', forRemaining: 0, pendingFn: null }));
          return;
        }
      }
      this.runState.update(s => ({ ...s, forRemaining: s.forRemaining - 1, step: 'evaluated' }));
      await this.executePendingFn();
      return;
    }
    // Op done — victoria se evalúa en END (finishBotRun)
    this.runState.update(s => ({ ...s, step: 'op-done', forRemaining: 0, pendingFn: null }));
  }

  private checkVictory(): PlayerId | null {
    const bots = this.currentState().bots;
    const p1Alive = bots.some(b => b.playerId === 1 && !b.destroyed);
    const p2Alive = bots.some(b => b.playerId === 2 && !b.destroyed);
    if (p1Alive && !p2Alive) return 1;
    if (!p1Alive && p2Alive) return 2;
    return null;
  }

  private async resolveFor(op: CompiledOperation, bot: BattleBot): Promise<void> {
    if (bot.numbers.length === 0) { await this.skipOp(bot, op.kind); return; }
    this.runState.update(s => ({ ...s, step: 'rolling', lastOpNotice: null }));
    await this.animateDelay();
    // Intercept offered BEFORE d6 roll
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = this.consumeD6();
    this.runState.update(s => ({ ...s, d6, step: 'picking-number' }));
  }

  /** Returns the next available interceptor for the active bot.
   *  Rules: only enemies at the MINIMUM distance can intercept. If multiple are tied
   *  at min distance, they're offered one by one (each call returns one not in `excludeIds`).
   *  An enemy with hasInterceptedThisTurn=true (already used their once-per-round intercept)
   *  or numbers.length===0 (nothing to substitute for d6) is not eligible. */
  private findInterceptBot(activeBot: BattleBot, excludeIds: ReadonlySet<string> = new Set()): BattleBot | null {
    const allBots = this.currentState().bots;
    const enemies = allBots.filter(
      b => !b.destroyed && b.playerId !== activeBot.playerId && b.q !== -999,
    );
    if (enemies.length === 0) return null;
    let minDist = Infinity;
    for (const e of enemies) {
      const d = hexDistance(activeBot.q, activeBot.r, e.q, e.r);
      if (d < minDist) minDist = d;
    }
    return enemies.find(
      e => hexDistance(activeBot.q, activeBot.r, e.q, e.r) === minDist
        && !e.hasInterceptedThisTurn
        && e.numbers.length > 0
        && !excludeIds.has(e.id),
    ) ?? null;
  }

  canIntercept(p: PlayerId): boolean {
    const rs = this.runState();
    if (!rs.interceptBotId) return false;
    const bot = this.currentState().bots.find(b => b.id === rs.interceptBotId);
    return bot?.playerId === p;
  }

  getInterceptBot(): BattleBot | null {
    const id = this.runState().interceptBotId;
    if (!id) return null;
    return this.currentState().bots.find(b => b.id === id) ?? null;
  }

  async skipIntercept(): Promise<void> {
    const rs = this.runState();
    const declinedId = rs.interceptBotId;
    const activeBot = this.currentRunBot();

    // Try to offer intercept to another equidistant candidate (rules:
    // multiple bots tied at the closest distance each get a chance, in sequence).
    if (declinedId && activeBot) {
      const declined = new Set([...rs.interceptDeclinedIds, declinedId]);
      const next = this.findInterceptBot(activeBot, declined);
      if (next) {
        this.runState.update(s => ({
          ...s,
          interceptBotId: next.id,
          interceptDeclinedIds: [...declined],
          step: 'intercept-prompt',
        }));
        return;
      }
    }

    // No more candidates → roll d6, clear declined list, proceed.
    const d6 = this.consumeD6();
    this.runState.update(s => ({
      ...s, d6, step: 'picking-number',
      interceptBotId: null, interceptDeclinedIds: [],
    }));
  }

  beginIntercept(): void {
    this.runState.update(s => ({ ...s, step: 'intercept-picking' }));
  }

  async pickInterceptNumber(n: number): Promise<void> {
    const rs = this.runState();
    if (!rs.interceptBotId) return;
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: new Date().toISOString(), botId: rs.interceptBotId,
      kind: 'intercept',
      payload: { interceptorId: rs.interceptBotId, substituteD6: n },
    }]);
    this.runState.update(st => ({
      ...st, d6: n, step: 'picking-number',
      interceptBotId: null, interceptDeclinedIds: [],
    }));
  }

  private async resolveTryCatch(op: CompiledOperation, bot: BattleBot): Promise<void> {
    // TRY: execute primary if energy/possible and wouldn't BUG; else CATCH (if any). Both fail → BUG.
    const primaryCost = fnEnergyCost(op.primary, this.functionsMap());
    const tryNoTargets = op.primary?.type === 'attack' &&
      computeAttackTargets(bot, op.primary, this.currentState().bots, this.currentState().hexMap, this.functionsMap()).size === 0;
    if (bot.energy >= primaryCost && !tryNoTargets) {
      // Execute primary directly without condition check
      this.runState.update(s => ({ ...s, branch: 'primary', pendingFn: op.primary, step: 'evaluated', condResult: true }));
      await this.executePendingFn();
      return;
    }
    if (op.secondary) {
      const secCost = fnEnergyCost(op.secondary, this.functionsMap());
      if (bot.energy >= secCost) {
        this.runState.update(s => ({ ...s, branch: 'secondary', pendingFn: op.secondary!, step: 'evaluated', condResult: false }));
        await this.executePendingFn();
        return;
      }
    }
    // Critical Exception
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
      timestamp: new Date().toISOString(), botId: bot.id,
      kind: 'bug_added', payload: { count: 1, reason: 'critical-exception' },
    }]);
    this.playBugAnim(bot);
    this.runState.update(st => ({ ...st, step: 'op-done' }));
  }

  async advanceOp(): Promise<void> {
    const bot = this.currentRunBot();
    if (!bot) return;
    const program = bot.compiledProgram?.operations ?? [];
    const nextIdx = this.runState().opIdx + 1;
    if (nextIdx >= program.length) {
      this.runState.update(s => ({ ...s, step: 'debug' }));
      return;
    }
    this.runState.set({
      ...initialRunState, botId: bot.id, opIdx: nextIdx, step: 'idle',
    });
  }

  async applyDebugFn(action: { action: string; n?: number }): Promise<void> {
    const bot = this.currentRunBot();
    if (!bot) return;
    const s = this.currentState();
    let energyCost = 0;
    let bugsRemoved = 0;
    let numbersRemoved = 0;
    if (action.action === 'debug') {
      if (bot.bugs === 0 || bot.energy < 2) return;
      energyCost = 2; bugsRemoved = 1;
    } else if (action.action === 'patch') {
      if (bot.bugs === 0 || bot.energy < 5) return;
      energyCost = 5; bugsRemoved = bot.bugs;
    } else if (action.action === 'optimize') {
      const n = action.n ?? 1;
      if (bot.numbers.length < n || bot.energy < n) return;
      energyCost = n; numbersRemoved = n;
    } else if (action.action === 'reboot') {
      energyCost = 0;
    } else {
      return;
    }
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'debug',
      timestamp: new Date().toISOString(), botId: bot.id,
      kind: 'debug_action',
      payload: { action: action.action, energyCost, bugsRemoved, numbersRemoved },
    }]);
  }

  /* ── Forced dice consumption (debug) ─────────────────────────── */

  private consumeD6(): number {
    const f = this.forcedRolls();
    if (typeof f.d6 === 'number') {
      this.forcedRolls.set({ ...f, d6: undefined });
      this.logForcedDice('d6', f.d6);
      return f.d6;
    }
    return rollD6();
  }

  private consumeD4(): number {
    const f = this.forcedRolls();
    if (typeof f.d4 === 'number') {
      this.forcedRolls.set({ ...f, d4: undefined });
      this.logForcedDice('d4', f.d4);
      return f.d4;
    }
    return rollDN(4);
  }

  private consumeOpFace(version: 1 | 2 | 3): OperationFace {
    const f = this.forcedRolls();
    if (f.opFace) {
      this.forcedRolls.set({ ...f, opFace: undefined });
      this.logForcedDice('opFace', f.opFace);
      return f.opFace;
    }
    return rollOperationDie(version);
  }

  private logForcedDice(kind: 'd6' | 'd4' | 'opFace', value: number | OperationFace): void {
    void this.appendEvents([{
      turn: this.currentState().turn, activation: this.currentState().currentActivationIdx,
      phase: this.currentState().phase, timestamp: new Date().toISOString(),
      kind: 'debug_dice_forced', payload: { kind, value },
    }]);
  }

  /* ── Debug mode actions ──────────────────────────────────────── */

  setForcedRoll(kind: 'd6' | 'd4' | 'opFace', value: number | OperationFace | null): void {
    this.forcedRolls.update(f => ({ ...f, [kind]: value ?? undefined }));
  }

  clearForcedRolls(): void {
    this.forcedRolls.set({});
  }

  async enableDebugMode(): Promise<void> {
    if (this.debugMode()) return;
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: s.phase,
      timestamp: new Date().toISOString(), kind: 'debug_enabled', payload: {},
    }]);
  }

  async applyDebugOverride(target: 'bot' | 'state', botId: string | undefined, patch: Record<string, unknown>): Promise<void> {
    if (!this.debugMode()) return;
    const s = this.currentState();
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: s.phase,
      timestamp: new Date().toISOString(), botId,
      kind: 'debug_override', payload: { target, patch },
    }]);
  }

  /** Drag&drop de un bot (sólo en debug mode). */
  async onDebugBotMoved(ev: { fromQ: number; fromR: number; toQ: number; toR: number }): Promise<void> {
    if (!this.debugMode()) return;
    const bot = this.currentState().bots.find(b => b.q === ev.fromQ && b.r === ev.fromR);
    if (!bot) return;
    await this.applyDebugOverride('bot', bot.id, { q: ev.toQ, r: ev.toR });
  }

  /** Trunca los últimos N eventos en el backend y refresca el log local. */
  async rewindEvents(count: number): Promise<void> {
    if (!this.debugMode() || count <= 0) return;
    const r = this.report();
    if (!r) return;
    const prev = this.events();
    const keepFirst = Math.max(0, prev.length - count);
    if (keepFirst === prev.length) return;
    this.saveError.set(null);
    this.pendingSaves.update(n => n + 1);
    try {
      const resp = await fetch(`${API_URL}/api/battles/${r.id}/events/truncate`, {
        method: 'POST',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ keepFirst }),
      });
      if (!resp.ok) {
        let detail = '';
        try { detail = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
        this.saveError.set(`Rewind falló (${resp.status})${detail ? ' · ' + detail : ''}.`);
        return;
      }
      this.events.set(prev.slice(0, keepFirst));
      this.runState.set(initialRunState);
    } catch (e) {
      this.saveError.set(String(e));
    } finally {
      this.pendingSaves.update(n => n - 1);
    }
  }

  /** Emit a turn_ended-skip for a rebooted bot, then chain to round_ended or next compile. */
  private async skipRebootedBot(botId: string): Promise<void> {
    const s = this.currentState();
    const ts = new Date().toISOString();
    const turnEndedEv: BattleEvent = {
      turn: s.turn, activation: s.currentActivationIdx, phase: 'end',
      timestamp: ts, botId, kind: 'turn_ended', payload: { reason: 'reboot-skip' },
    };
    const isLastBot = s.currentActivationIdx + 1 >= s.activationOrder.length;
    const chainEv: BattleEvent = isLastBot
      ? { turn: s.turn, activation: 0, phase: 'end', timestamp: ts, kind: 'round_ended', payload: { nextTurn: s.turn + 1 } }
      : { turn: s.turn, activation: s.currentActivationIdx + 1, phase: 'compile', timestamp: ts, kind: 'phase_changed', payload: { from: 'end', to: 'compile' } };
    await this.appendEvents([turnEndedEv, chainEv]);
    this.runState.set(initialRunState);
  }

  async finishBotRun(_botId?: string): Promise<void> {
    const bot = this.currentRunBot();
    const s = this.currentState();
    if (s.status === 'finished') {
      this.runState.set(initialRunState);
      return;
    }

    const ts = new Date().toISOString();
    const turnEndedEv: BattleEvent = {
      turn: s.turn, activation: s.currentActivationIdx, phase: 'end',
      timestamp: ts, botId: bot?.id ?? _botId, kind: 'turn_ended', payload: {},
    };

    // Victory check can run before turn_ended is saved (it only reads bot life values,
    // not activation index, so the result is identical).
    const winner = this.checkVictory();
    if (winner) {
      await this.appendEvents([
        turnEndedEv,
        { turn: s.turn, activation: s.currentActivationIdx, phase: 'finished', timestamp: ts, kind: 'victory', payload: { winner } },
      ]);
      this.runState.set(initialRunState);
      return;
    }

    // Batch turn_ended + chain event so both are applied in one signal update,
    // preventing the momentary phase='end' flash between bots.
    const isLastBot = s.currentActivationIdx + 1 >= s.activationOrder.length;
    const chainEv: BattleEvent = isLastBot
      ? { turn: s.turn, activation: 0, phase: 'end', timestamp: ts, kind: 'round_ended', payload: { nextTurn: s.turn + 1 } }
      : { turn: s.turn, activation: s.currentActivationIdx + 1, phase: 'compile', timestamp: ts, kind: 'phase_changed', payload: { from: 'end', to: 'compile' } };
    await this.appendEvents([turnEndedEv, chainEv]);
    this.runState.set(initialRunState);
  }

  async bootRollFor(botId: string, chosen: 0 | 1 | 2 | 3): Promise<void> {
    if (this.bootRollingFor()) return;
    const bot = this.currentState().bots.find(b => b.id === botId);
    if (!bot) return;
    if (chosen > 0) {
      this.bootRollingFor.set(botId);
      await this.animateDelay();
    }
    const s = this.currentState();
    const result = rollBoot(bot, chosen, s.turn, s.currentActivationIdx);
    await this.appendEvents(result.events);
    this.bootRollingFor.set(null);
  }


  async rollColorDice(): Promise<void> {
    if (this.rollingColor()) return;
    this.rollingColor.set(true);
    this.pendingRoll.set(null);
    await this.animateDelay();
    const color = rollDadoColores();
    this.pendingRoll.set(color);
    this.rollingColor.set(false);
    const deployer = this.activeDeployer();
    const bot = this.nextBot();
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      botId: bot?.id,
      kind: 'color_rolled',
      payload: { player: deployer, color },
    }]);
  }

  rerollColorDice(): void {
    this.rollColorDice();
  }

  async onHexClick(coord: { q: number; r: number }): Promise<void> {
    const rs = this.runState();
    if (rs.botId && rs.step === 'dash-move') {
      const valid = this.selectableHexes();
      if (!valid?.has(hexKey(coord.q, coord.r))) return;
      await this.pickDashMoveHex(coord.q, coord.r);
      return;
    }
    if (rs.botId && rs.step === 'shadow-step') {
      const valid = this.selectableHexes();
      if (!valid?.has(hexKey(coord.q, coord.r))) return;
      await this.pickShadowStepHex(coord.q, coord.r);
      return;
    }
    if (rs.botId && rs.step === 'picking-hex') {
      const valid = this.selectableHexes();
      if (!valid?.has(hexKey(coord.q, coord.r))) return;
      await this.pickRunHex(coord.q, coord.r);
      return;
    }
    if (rs.botId && rs.step === 'picking-target') {
      const target = this.currentState().bots.find(
        b => !b.destroyed && b.q === coord.q && b.r === coord.r,
      );
      if (!target) return;
      const valid = this.selectableHexes();
      if (!valid?.has(hexKey(coord.q, coord.r))) return;
      await this.pickRunTarget(target.id);
      return;
    }

    const color = this.pendingRoll();
    const deployer = this.activeDeployer();
    if (!color || !deployer) return;
    const valid = this.selectableHexes();
    if (!valid?.has(hexKey(coord.q, coord.r))) return;
    const bot = this.currentState().bots.find(b => b.playerId === deployer && b.q === -999);
    if (!bot) return;

    const ev: BattleEvent = {
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      botId: bot.id,
      kind: 'deployed',
      payload: { q: coord.q, r: coord.r, color },
    };
    await this.appendEvents([ev]);
    this.pendingRoll.set(null);
  }

  private async appendEvents(newEvs: BattleEvent[]): Promise<boolean> {
    const r = this.report();
    if (!r) return false;
    this.saveError.set(null);
    const prev = this.events();
    this.events.set([...prev, ...newEvs]);
    this.pendingSaves.update(n => n + 1);
    try {
      const resp = await fetch(`${API_URL}/api/battles/${r.id}/events`, {
        method: 'PATCH',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ events: newEvs }),
      });
      if (!resp.ok) {
        this.events.set(prev);
        let detail = '';
        try { detail = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
        this.saveError.set(`No se pudo guardar (${resp.status})${detail ? ' · ' + detail : ''}. Reintenta.`);
        return false;
      }
      return true;
    } catch (e) {
      this.events.set(prev);
      this.saveError.set(String(e));
      return false;
    } finally {
      this.pendingSaves.update(n => n - 1);
    }
  }

  async finish(): Promise<void> {
    const r = this.report();
    if (!r) return;
    this.finishing.set(true);
    try {
      await fetch(`${API_URL}/api/battles/${r.id}/finish`, {
        method: 'PATCH',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ winner: null, finalState: this.currentState() }),
      });
      this.router.navigate(['/admin/simulator']);
    } catch (e) {
      this.error.set(String(e));
    }
    this.finishing.set(false);
  }
}
