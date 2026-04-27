import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import { type DotColor, type HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import {
  hexKey,
  type BattleBot,
  type BattleEvent,
  type BattleReport,
  type BattleState,
  type CompiledOperation,
  type CompiledProgram,
  type PlayerId,
} from '../../../shared/types/battle.types';
import { evaluate, rollD6, rollDadoColores, rollOperationDie } from './engine/dice';
import { reachableHexes } from './engine/pathfinding';
import { replayTo } from './engine/replay';
import { rollBoot } from './simulator-boot';
import { CompileEditor } from './simulator-compile-editor';
import { SimulatorBotCard, type FunctionEntry } from './simulator-bot-card';
import { SimulatorRunPanel } from './simulator-run-panel';
import {
  computeAttackTargets,
  findClosestEnemyOf,
  fnEnergyCost,
  initialRunState,
  parseDamage,
  type RunState,
} from './simulator-run.utils';
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
  imports: [RouterLink, HexMap, NgTemplateOutlet, JsonPipe, SimulatorBotCard, CompileEditor, SimulatorRunPanel],
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

  pendingSaves = signal(0);

  runState = signal<RunState>(initialRunState);
  nextRoundTurn = signal<number>(1);

  functionsMap = signal<Map<string, FunctionEntry>>(new Map());
  selectedBotIdx = signal<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  expandedAttackVersion = signal<Record<string, 1 | 2 | 3 | null>>({});
  manualBotSelectionFor = signal<Set<PlayerId>>(new Set());

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
    const deployments = s.bots
      .filter(b => b.q !== -999)
      .map(b => ({
        q: b.q,
        r: b.r,
        type: 'player' as const,
        team: b.playerId,
        label: b.name,
      }));
    return { ...s.hexMap, deployments };
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
      if (rs.step === 'picking-hex' && rs.pendingFn.type === 'move') {
        const dist = rs.pendingFn.moveDistance ?? 0;
        const maxByEnergy = Math.min(dist, bot.energy);
        if (maxByEnergy <= 0) return new Set();
        return reachableHexes(bot.q, bot.r, maxByEnergy, this.currentState().hexMap, this.currentState().bots, bot.id);
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
    if (rs.step === 'picking-hex') return '#3b82f6';
    if (rs.step === 'picking-target') return '#ef4444';
    const c = this.pendingRoll();
    return c ? COLOR_HEX[c] : '#3b82f6';
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

    const compileBot = this.nextCompileBot();
    if (compileBot) {
      return { player: compileBot.playerId, alias: aliasFor(compileBot.playerId), sub: `COMPILE · ${compileBot.name}` };
    }

    const runBot = this.currentRunBot();
    if (runBot) {
      return { player: runBot.playerId, alias: aliasFor(runBot.playerId), sub: `RUN · ${runBot.name}` };
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

  isActive(p: PlayerId): boolean {
    const phase = this.currentState().phase;
    const bootBot = this.nextBootBot();
    if (bootBot) return bootBot.playerId === p;
    if (phase === 'boot') return true;
    if (phase === 'compile') {
      const cb = this.nextCompileBot();
      return cb ? cb.playerId === p : true;
    }
    if (phase === 'run') {
      const rb = this.currentRunBot();
      return rb ? rb.playerId === p : true;
    }
    if (phase === 'end') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1;
        if (isp === 'ppt-p2') return p === 2;
        if (isp === 'ppt-result') return true;
      }
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
      const cb = this.nextCompileBot();
      if (!cb) return 'active';
      return cb.playerId === p ? 'active' : 'waiting';
    }
    if (phase === 'run') {
      const rb = this.currentRunBot();
      if (!rb) return 'active';
      return rb.playerId === p ? 'active' : 'waiting';
    }
    if (phase === 'end') {
      if (this.initStarted()) {
        const isp = this.initSubPhase();
        if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
        if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
        return 'active';
      }
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
    if (runBot) return `RUN · ${runBot.name} (P${runBot.playerId})`;
    if (phase === 'run') return 'RUN';
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
    if (c1 && c2 && c1 === c2 && (c1 === 'junior-1' || c1 === 'junior-2')) {
      const starter: PlayerId = c1 === 'junior-1' ? 1 : 2;
      this.deployStarter.set(starter);
      await this.appendEvents([{
        turn: 0, activation: 0, phase: 'deploy',
        timestamp: new Date().toISOString(),
        kind: 'ppt_starter_set',
        payload: { starter, reason: 'junior-agreement' },
      }]);
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

  private async resolveIfLike(_op: CompiledOperation, bot: BattleBot): Promise<void> {
    this.runState.update(s => ({ ...s, step: 'rolling' }));
    await this.animateDelay();
    const opFace = rollOperationDie(bot.version);
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, opFace, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = rollD6();
    this.runState.update(s => ({ ...s, opFace, d6, step: 'picking-number' }));
  }

  private async resolveWhile(_op: CompiledOperation, bot: BattleBot): Promise<void> {
    this.runState.update(s => ({ ...s, step: 'rolling' }));
    await this.animateDelay();
    const opFace = rollOperationDie(bot.version);
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, opFace, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = rollD6();
    this.runState.update(s => ({ ...s, opFace, d6, step: 'picking-number' }));
  }

  async pickNumber(n: number): Promise<void> {
    const rs = this.runState();
    const op = this.currentRunOp();
    const bot = this.currentRunBot();
    if (!op || !bot || rs.step !== 'picking-number' || !rs.opFace || rs.d6 === null) return;

    if (op.kind === 'FOR') {
      // FOR: pickedNumber + d6 → diff
      const diff = Math.abs(rs.d6 - n);
      const s = this.currentState();
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'operation_resolved',
        payload: { opIdx: rs.opIdx, kind: 'FOR', d6: rs.d6, picked: n, diff },
      }]);
      if (diff === 0 || diff > 3) {
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'bug_added', payload: { count: 1, reason: 'infinite-loop' },
        }]);
        this.runState.update(st => ({ ...st, pickedNumber: n, step: 'op-done', condResult: false }));
        return;
      }
      this.runState.update(st => ({
        ...st, pickedNumber: n, forRemaining: diff, branch: 'primary',
        pendingFn: op.primary, condResult: true, step: 'evaluated',
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
        payload: { opIdx: rs.opIdx, kind: 'WHILE', opFace: rs.opFace, d6: rs.d6, picked: n, condResult },
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
      payload: { opIdx: rs.opIdx, kind: op.kind, opFace: rs.opFace, d6: rs.d6, picked: n, condResult },
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
      }
      await this.afterFnExecuted();
      return;
    }
    if (fn.type === 'move') {
      // Pre-check: if no energy at all, OVERLOAD with full requested cost
      if (bot.energy <= 0) {
        await this.applyOverload(bot, fn.moveDistance ?? 0, 'move');
        await this.afterFnExecuted();
        return;
      }
      this.runState.update(s => ({ ...s, step: 'picking-hex' }));
      return;
    }
    if (fn.type === 'attack') {
      const targets = computeAttackTargets(bot, fn, this.currentState().bots, this.currentState().hexMap, this.functionsMap());
      if (targets.size === 0) {
        const s = this.currentState();
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: bot.id,
          kind: 'bug_added', payload: { count: 1, reason: 'no-targets-in-range' },
        }]);
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
  }

  async pickRunHex(q: number, r: number): Promise<void> {
    const rs = this.runState();
    const bot = this.currentRunBot();
    const fn = rs.pendingFn;
    if (!bot || !fn || fn.type !== 'move') return;
    const requested = fn.moveDistance ?? 0;
    const cost = requested; // move(n) cuesta n
    const s = this.currentState();
    if (bot.energy < cost) {
      await this.applyOverload(bot, cost, 'move');
    } else {
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'move', payload: { toQ: q, toR: r, energyCost: cost },
      }]);
    }
    await this.afterFnExecuted();
  }

  async pickRunTarget(targetId: string): Promise<void> {
    const rs = this.runState();
    const bot = this.currentRunBot();
    const fn = rs.pendingFn;
    if (!bot || !fn || fn.type !== 'attack') return;
    const target = this.currentState().bots.find(b => b.id === targetId);
    if (!target) return;
    const entry = fn.attackFunctionId ? this.functionsMap().get(fn.attackFunctionId) : undefined;
    const cost = fnEnergyCost(fn, this.functionsMap());
    const damage = parseDamage(entry?.damage);
    const s = this.currentState();
    if (bot.energy < cost) {
      await this.applyOverload(bot, cost, 'attack');
    } else {
      const shieldConsumed = Math.min(target.shield, damage);
      const dealt = Math.max(0, damage - shieldConsumed);
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
        timestamp: new Date().toISOString(), botId: bot.id,
        kind: 'attack_hit',
        payload: { targetId, damage: dealt, shieldConsumed, energyCost: cost, functionId: fn.attackFunctionId },
      }]);
      if (target.life - dealt <= 0) {
        await this.appendEvents([{
          turn: s.turn, activation: s.currentActivationIdx, phase: 'run',
          timestamp: new Date().toISOString(), botId: targetId,
          kind: 'destroyed', payload: {},
        }]);
      }
    }
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
        const winner = this.checkVictory();
        if (winner) {
          const st = this.currentState();
          await this.appendEvents([{
            turn: st.turn, activation: st.currentActivationIdx, phase: 'finished',
            timestamp: new Date().toISOString(), kind: 'victory', payload: { winner },
          }]);
        }
        return;
      }
      // New condition check for next iteration
      this.runState.update(s => ({ ...s, step: 'rolling', opFace: null, d6: null, pickedNumber: null, condResult: null, pendingFn: null }));
      await this.animateDelay();
      const opFace = rollOperationDie(bot.version);
      const interceptBot = this.findInterceptBot(bot);
      if (interceptBot) {
        this.runState.update(s => ({ ...s, opFace, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
        return;
      }
      const d6 = rollD6();
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
          const winner = this.checkVictory();
          if (winner) {
            const st = this.currentState();
            await this.appendEvents([{
              turn: st.turn, activation: st.currentActivationIdx, phase: 'finished',
              timestamp: new Date().toISOString(), kind: 'victory', payload: { winner },
            }]);
          }
          return;
        }
      }
      this.runState.update(s => ({ ...s, forRemaining: s.forRemaining - 1, step: 'evaluated' }));
      await this.executePendingFn();
      return;
    }
    // Op done
    this.runState.update(s => ({ ...s, step: 'op-done', forRemaining: 0, pendingFn: null }));
    // Check victory after each function
    const winner = this.checkVictory();
    if (winner) {
      const s = this.currentState();
      await this.appendEvents([{
        turn: s.turn, activation: s.currentActivationIdx, phase: 'finished',
        timestamp: new Date().toISOString(),
        kind: 'victory', payload: { winner },
      }]);
    }
  }

  private checkVictory(): PlayerId | null {
    const bots = this.currentState().bots;
    const p1Alive = bots.some(b => b.playerId === 1 && !b.destroyed);
    const p2Alive = bots.some(b => b.playerId === 2 && !b.destroyed);
    if (p1Alive && !p2Alive) return 1;
    if (!p1Alive && p2Alive) return 2;
    return null;
  }

  private async resolveFor(__op: CompiledOperation, bot: BattleBot): Promise<void> {
    this.runState.update(s => ({ ...s, step: 'rolling' }));
    await this.animateDelay();
    // Intercept offered BEFORE d6 roll
    const interceptBot = this.findInterceptBot(bot);
    if (interceptBot) {
      this.runState.update(s => ({ ...s, d6: null, step: 'intercept-prompt', interceptBotId: interceptBot.id }));
      return;
    }
    const d6 = rollD6();
    this.runState.update(s => ({ ...s, d6, step: 'picking-number' }));
  }

  private findInterceptBot(activeBot: BattleBot): BattleBot | null {
    const bots = this.currentState().bots.filter(
      b => !b.destroyed && !b.hasInterceptedThisTurn && b.numbers.length > 0,
    );
    return findClosestEnemyOf(activeBot.q, activeBot.r, activeBot.playerId, bots);
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
    const d6 = rollD6();
    this.runState.update(s => ({ ...s, d6, step: 'picking-number', interceptBotId: null }));
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
    this.runState.update(st => ({ ...st, d6: n, step: 'picking-number', interceptBotId: null }));
  }

  private async resolveTryCatch(op: CompiledOperation, bot: BattleBot): Promise<void> {
    // TRY: execute primary if energy/possible; else CATCH (if any). Both fail → BUG.
    const primaryCost = fnEnergyCost(op.primary, this.functionsMap());
    if (bot.energy >= primaryCost) {
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

  async finishBotRun(_botId?: string): Promise<void> {
    const bot = this.currentRunBot();
    const s = this.currentState();
    if (s.status === 'finished') {
      this.runState.set(initialRunState);
      return;
    }
    await this.appendEvents([{
      turn: s.turn, activation: s.currentActivationIdx, phase: 'end',
      timestamp: new Date().toISOString(), botId: bot?.id ?? _botId,
      kind: 'turn_ended', payload: {},
    }]);
    this.runState.set(initialRunState);
    const after = this.currentState();
    if (after.currentActivationIdx >= after.activationOrder.length) {
      // Round ended — wait for INIT of next round (handled separately)
      await this.appendEvents([{
        turn: after.turn, activation: 0, phase: 'end',
        timestamp: new Date().toISOString(),
        kind: 'round_ended', payload: { nextTurn: after.turn + 1 },
      }]);
    } else {
      // Next bot starts its COMPILE
      await this.appendEvents([{
        turn: after.turn, activation: after.currentActivationIdx, phase: 'compile',
        timestamp: new Date().toISOString(),
        kind: 'phase_changed',
        payload: { from: 'end', to: 'compile' },
      }]);
    }
  }

  async bootRollFor(botId: string, chosen: 1 | 2 | 3): Promise<void> {
    if (this.bootRollingFor()) return;
    const bot = this.currentState().bots.find(b => b.id === botId);
    if (!bot) return;
    this.bootRollingFor.set(botId);
    await this.animateDelay();
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
