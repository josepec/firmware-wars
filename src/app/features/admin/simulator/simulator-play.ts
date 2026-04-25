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
  type PlayerId,
} from '../../../shared/types/battle.types';
import { rollDadoColores } from './engine/dice';
import { replayTo } from './engine/replay';
import { rollBoot } from './simulator-boot';
import { SimulatorBotCard, type FunctionEntry } from './simulator-bot-card';
import {
  ANIM_KEY,
  ANIM_MS,
  API_URL,
  COLOR_HEX,
  DEPLOY_PERIMETER,
  choiceLabel,
  computeValidDeployHexes,
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
  imports: [RouterLink, HexMap, NgTemplateOutlet, JsonPipe, SimulatorBotCard],
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
    if (this.currentState().phase !== 'deploy') return 'done';
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
    const color = this.pendingRoll();
    if (!color) return null;
    const deployer = this.activeDeployer();
    if (!deployer) return new Set();
    return computeValidDeployHexes(this.currentState(), color, deployer);
  });

  readonly highlightedHexes = computed<Set<string> | null>(() => this.selectableHexes());
  readonly highlightColor = computed<string>(() => {
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

    const bootBot = this.nextBootBot();
    if (bootBot) {
      return { player: bootBot.playerId, alias: aliasFor(bootBot.playerId), sub: `BOOT · ${bootBot.name}` };
    }

    if (this.initStarted() && this.currentState().phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return { player: 1, alias: aliasFor(1), sub: 'INIT · Tira Dado PPT' };
      if (isp === 'ppt-p2') return { player: 2, alias: aliasFor(2), sub: 'INIT · Tira Dado PPT' };
      return null;
    }
    if (this.currentState().phase === 'init') return null;

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
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
    this.loadFunctions();
  }

  private async loadFunctions(): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/functions`, { headers: this.auth.authHeaders() });
      if (!resp.ok) return;
      const list = (await resp.json()) as FunctionEntry[];
      const map = new Map<string, FunctionEntry>();
      for (const f of list) map.set(f.id, f);
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
          }
          break;
        }
        case 'ppt_starter_set': {
          this.deployStarter.set(p['starter'] as PlayerId);
          break;
        }
        case 'init_ppt': {
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
    if (this.initStarted() && phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1;
      if (isp === 'ppt-p2') return p === 2;
      if (isp === 'ppt-result') return true;
      return false;
    }
    if (phase === 'init') return true;
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
    if (this.initStarted() && phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
      if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
      return 'active';
    }
    if (phase === 'init') return 'active';
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
    const bootBot = this.nextBootBot();
    if (bootBot) return `BOOT · ${bootBot.name} (P${bootBot.playerId})`;
    if (phase === 'boot') return 'BOOT · Completado';
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
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_rolled',
      payload: { player, hand, context: 'init' as PptContext },
    }]);
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
      turn: 1, activation: 0, phase: 'init',
      timestamp: new Date().toISOString(),
      kind: 'init_ppt',
      payload: { winner, activationOrder: order },
    }]);
    if (!ok) return;
    this.initStarted.set(false);
    this.initPptP1.set(null);
    this.initPptP2.set(null);
    this.bootStarted.set(true);
  }

  startBoot(): void {
    this.bootStarted.set(true);
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

  activationOrderNames(): string[] {
    const s = this.currentState();
    const byId = new Map(s.bots.map(b => [b.id, b]));
    return s.activationOrder.map(id => {
      const bot = byId.get(id);
      return bot ? `P${bot.playerId}·${bot.name}` : id;
    });
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
