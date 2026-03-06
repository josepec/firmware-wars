import { Component, OnInit, OnDestroy, signal, inject, HostListener, effect } from '@angular/core';
import { NgClass } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  DataService,
  AttackFunction,
  PointDefinition,
  BotVariableDefinition,
  GameConfig,
} from '../../core/services/data';
import { classifyCode } from '../../shared/markdown/marked-extensions';

/* ── Local interfaces ─────────────────────────────────────── */
interface PointAllocation {
  constant: string;
  type: 'mejora' | 'desventaja' | null;
}

interface BotConfig {
  name: string;
  points: PointAllocation[];
  attackFunctions: {
    v1: (AttackFunction | null)[];
    v2: (AttackFunction | null)[];
    v3: AttackFunction | null;
  };
  collapsed: boolean;
}

interface CompileState {
  phase: 'compiling' | 'done';
  lines: string[];
}

@Component({
  selector: 'app-army-builder',
  imports: [NgClass],
  templateUrl: './army-builder.html',
  styleUrl: './army-builder.scss',
})
export class ArmyBuilder implements OnInit, OnDestroy {
  private readonly data = inject(DataService);

  readonly Math = Math;
  readonly loaded = signal(false);
  readonly programmerName = signal('ANON_DEV');
  readonly editingName = signal(false);
  readonly bots = signal<BotConfig[]>([]);

  /* ── Compile animation state ─────────────────────────────── */
  readonly compileStates = signal<Record<number, CompileState>>({});
  private compileTimers = new Map<number, ReturnType<typeof setInterval>>();
  private validityCache: boolean[] = [];

  constructor() {
    effect(() => {
      const bots = this.bots();
      bots.forEach((bot, idx) => {
        const valid = this.isBotValid(bot);
        const wasValid = this.validityCache[idx] ?? false;
        if (valid && !wasValid) this.startCompile(idx, bot);
        else if (!valid && wasValid) this.clearCompile(idx);
        this.validityCache[idx] = valid;
      });
      if (this.validityCache.length > bots.length) {
        this.validityCache.length = bots.length;
      }
    });
  }

  /* ── Data loaded from JSON ──────────────────────────────── */
  allFunctions: AttackFunction[] = [];
  v1Functions: AttackFunction[] = [];
  v2Functions: AttackFunction[] = [];
  v3Functions: AttackFunction[] = [];
  pointDefinitions: PointDefinition[] = [];
  baseStats: Record<string, number> = {};
  gameConfig!: GameConfig;

  variableDescriptions: Record<string, string> = {};
  botNames: string[] = [];

  /* ── Dropdown state ─────────────────────────────────────── */
  activeDropdown = signal<string | null>(null);
  hoveredFunction = signal<AttackFunction | null>(null);

  ngOnInit() {
    forkJoin({
      config: this.data.getGameConfig(),
      attacks: this.data.getAttackFunctions(),
      points: this.data.getPoints(),
      variables: this.data.getInitialBotVariables(),
      names: this.data.getBotNames(),
    }).subscribe(({ config, attacks, points, variables, names }) => {
      this.gameConfig = config;
      this.allFunctions = attacks;
      this.v1Functions = attacks.filter(f => f.version === 1);
      this.v2Functions = attacks.filter(f => f.version === 2);
      this.v3Functions = attacks.filter(f => f.version === 3);
      this.pointDefinitions = points;
      this.baseStats = this.buildBaseStats(variables);
      for (const v of variables) this.variableDescriptions[v.variable] = v.description;
      this.botNames = names;
      this.bots.set([this.createEmptyBot(0)]);
      this.loaded.set(true);
    });
  }

  private buildBaseStats(variables: BotVariableDefinition[]): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const v of variables) {
      if (v.variable.startsWith('MAX_')) {
        const num = parseInt(v.initialValue);
        if (!isNaN(num)) stats[v.variable] = num;
      }
    }
    return stats;
  }

  private createEmptyBot(index: number): BotConfig {
    return {
      name: `BOT_${index + 1}`,
      points: this.pointDefinitions.map(p => ({ constant: p.constant, type: null })),
      attackFunctions: {
        v1: Array(this.gameConfig.slotsPerVersion.v1).fill(null),
        v2: Array(this.gameConfig.slotsPerVersion.v2).fill(null),
        v3: null,
      },
      collapsed: false,
    };
  }

  /* ── Bot management ─────────────────────────────────────── */

  addBot() {
    if (this.bots().length < this.gameConfig.maxBots) {
      this.bots.update(b => [...b, this.createEmptyBot(b.length)]);
    }
  }

  removeBot(index: number) {
    if (this.bots().length > 1) {
      for (const timer of this.compileTimers.values()) clearInterval(timer);
      this.compileTimers.clear();
      this.compileStates.set({});
      this.validityCache = [];
      this.bots.update(b => b.filter((_, i) => i !== index));
    }
  }

  toggleCollapse(index: number) {
    this.bots.update(b => b.map((bot, i) => i === index ? { ...bot, collapsed: !bot.collapsed } : bot));
  }

  /* ── Bot name ───────────────────────────────────────────── */

  updateBotName(index: number, name: string) {
    this.bots.update(b => b.map((bot, i) => i === index ? { ...bot, name: name.toUpperCase() || `BOT_${i + 1}` } : bot));
  }

  randomizeName(index: number) {
    if (!this.botNames.length) return;
    const usedNames = new Set(this.bots().map(b => b.name));
    const available = this.botNames.filter(n => !usedNames.has(n));
    const pool = available.length ? available : this.botNames;
    const name = pool[Math.floor(Math.random() * pool.length)];
    this.updateBotName(index, name);
  }

  /* ── Points allocation ──────────────────────────────────── */

  getPointDef(constant: string): PointDefinition | undefined {
    return this.pointDefinitions.find(p => p.constant === constant);
  }

  getMejorasUsed(bot: BotConfig): number {
    return bot.points.filter(p => p.type === 'mejora').length;
  }

  getDesventajasUsed(bot: BotConfig): number {
    return bot.points.filter(p => p.type === 'desventaja').length;
  }

  togglePoint(botIndex: number, constant: string, type: 'mejora' | 'desventaja') {
    this.bots.update(bots => bots.map((bot, i) => {
      if (i !== botIndex) return bot;
      const points = bot.points.map(p => {
        if (p.constant !== constant) return p;
        if (p.type === type) return { ...p, type: null as 'mejora' | 'desventaja' | null };
        return { ...p, type };
      });

      const mejoras = points.filter(p => p.type === 'mejora').length;
      const desventajas = points.filter(p => p.type === 'desventaja').length;
      if (mejoras > this.gameConfig.improvementPoints || desventajas > this.gameConfig.disadvantagePoints) return bot;

      return { ...bot, points };
    }));
  }

  getStatValue(bot: BotConfig, constant: string): number {
    const base = this.baseStats[constant] ?? 0;
    const point = bot.points.find(p => p.constant === constant);
    if (!point?.type) return base;
    const def = this.getPointDef(constant);
    if (!def) return base;
    return base + parseInt(point.type === 'mejora' ? def.mejora : def.desventaja);
  }

  /* ── Function selection ─────────────────────────────────── */

  selectFunction(botIndex: number, version: 'v1' | 'v2' | 'v3', slotIndex: number, fn: AttackFunction | null) {
    this.bots.update(bots => bots.map((bot, i) => {
      if (i !== botIndex) return bot;
      const af = { ...bot.attackFunctions };
      if (version === 'v3') {
        af.v3 = fn;
      } else {
        const arr = [...af[version]];
        arr[slotIndex] = fn;
        af[version] = arr;
      }
      return { ...bot, attackFunctions: af };
    }));
  }

  getNibblesCost(bot: BotConfig): number {
    let total = 0;
    for (const fn of bot.attackFunctions.v1) if (fn) total += fn.cost;
    for (const fn of bot.attackFunctions.v2) if (fn) total += fn.cost;
    if (bot.attackFunctions.v3) total += bot.attackFunctions.v3.cost;
    return total;
  }

  getNibblesRemaining(bot: BotConfig): number {
    return this.gameConfig.maxNibbles - this.getNibblesCost(bot);
  }

  isFunctionUsedInBot(bot: BotConfig, fn: AttackFunction, excludeVersion?: string, excludeSlot?: number): boolean {
    let checkList: (AttackFunction | null)[] = [];
    if (excludeVersion !== undefined) {
      bot.attackFunctions.v1.forEach((f, i) => {
        if (excludeVersion === 'v1' && i === excludeSlot) return;
        checkList.push(f);
      });
      bot.attackFunctions.v2.forEach((f, i) => {
        if (excludeVersion === 'v2' && i === excludeSlot) return;
        checkList.push(f);
      });
      if (excludeVersion !== 'v3') checkList.push(bot.attackFunctions.v3);
    } else {
      checkList = [
        ...bot.attackFunctions.v1,
        ...bot.attackFunctions.v2,
        bot.attackFunctions.v3,
      ];
    }
    return checkList.some(f => f?.name === fn.name);
  }

  getAvailableFunctions(bot: BotConfig, version: 'v1' | 'v2' | 'v3', slotIndex: number): AttackFunction[] {
    const catalog = version === 'v1' ? this.v1Functions : version === 'v2' ? this.v2Functions : this.v3Functions;
    return catalog.filter(fn => {
      if (this.isFunctionUsedInBot(bot, fn, version, slotIndex)) return false;
      const currentSlot = version === 'v3' ? bot.attackFunctions.v3 : bot.attackFunctions[version][slotIndex];
      const currentCost = currentSlot?.cost ?? 0;
      const newTotal = this.getNibblesCost(bot) - currentCost + fn.cost;
      return newTotal <= this.gameConfig.maxNibbles;
    });
  }

  /* ── Validation ─────────────────────────────────────────── */

  isBotValid(bot: BotConfig): boolean {
    if (this.getMejorasUsed(bot) !== this.gameConfig.improvementPoints) return false;
    if (this.getDesventajasUsed(bot) !== this.gameConfig.disadvantagePoints) return false;
    if (bot.attackFunctions.v1.some(f => !f)) return false;
    if (bot.attackFunctions.v2.some(f => !f)) return false;
    if (!bot.attackFunctions.v3) return false;
    return true;
  }

  isListValid(): boolean {
    return this.bots().every(b => this.isBotValid(b));
  }

  /* ── Print ──────────────────────────────────────────────── */

  printBotSheet() {
    window.print();
  }

  /* ── Effects formatting ─────────────────────────────────── */

  private effectsCache = new Map<string, string>();

  formatEffects(text: string): string {
    if (!text) return '';
    const cached = this.effectsCache.get(text);
    if (cached) return cached;
    const html = text.replace(/`([^`]+)`/g, (_, code: string) => {
      const cls = classifyCode(code);
      return cls
        ? `<code class="${cls}">${code}</code>`
        : `<code>${code}</code>`;
    });
    this.effectsCache.set(text, html);
    return html;
  }

  /* ── Dropdown ───────────────────────────────────────────── */

  toggleDropdown(id: string) {
    this.hoveredFunction.set(null);
    this.activeDropdown.update(v => v === id ? null : id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.activeDropdown()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.fn-dropdown') && !target.closest('[data-dropdown-trigger]')) {
      this.activeDropdown.set(null);
      this.hoveredFunction.set(null);
    }
  }

  /* ── Compile animation ───────────────────────────────────── */

  private startCompile(idx: number, bot: BotConfig) {
    const allLines = this.generateCompileLines(bot);
    let lineIdx = 0;

    this.compileStates.update(s => ({ ...s, [idx]: { phase: 'compiling' as const, lines: [] } }));

    const timer = setInterval(() => {
      if (lineIdx < allLines.length) {
        const line = allLines[lineIdx];
        this.compileStates.update(s => ({
          ...s,
          [idx]: { ...s[idx], lines: [...s[idx].lines, line] },
        }));
        lineIdx++;
      } else {
        clearInterval(timer);
        this.compileTimers.delete(idx);
        setTimeout(() => {
          this.compileStates.update(s => ({
            ...s,
            [idx]: { ...s[idx], phase: 'done' as const },
          }));
        }, 350);
      }
    }, 250);

    this.compileTimers.set(idx, timer);
  }

  private clearCompile(idx: number) {
    const timer = this.compileTimers.get(idx);
    if (timer) {
      clearInterval(timer);
      this.compileTimers.delete(idx);
    }
    this.compileStates.update(s => {
      const copy = { ...s };
      delete copy[idx];
      return copy;
    });
  }

  private generateCompileLines(bot: BotConfig): string[] {
    const fns = [
      ...bot.attackFunctions.v1.filter(Boolean).map(f => f!.name),
      ...bot.attackFunctions.v2.filter(Boolean).map(f => f!.name),
      ...(bot.attackFunctions.v3 ? [bot.attackFunctions.v3.name] : []),
    ];
    const mods = bot.points.filter(p => p.type).length;
    return [
      `> INIT COMPILER v28.1...`,
      `> LOADING ${bot.name}.CFG...`,
      `> CONSTANTS MAPPED [${mods} MODIFIED]`,
      `> BINDING [${fns.join(', ')}]`,
      `> NIBBLES: ${this.getNibblesCost(bot)}◈ / ${this.gameConfig.maxNibbles}◈ ALLOCATED`,
      `> DIAGNOSTICS... PASSED`,
      `> BUILD SUCCESSFUL`,
    ];
  }

  ngOnDestroy() {
    for (const timer of this.compileTimers.values()) clearInterval(timer);
  }
}
