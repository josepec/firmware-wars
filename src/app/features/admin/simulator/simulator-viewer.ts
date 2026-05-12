import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import type { HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import type {
  BattleBot,
  BattleEvent,
  BattleReport,
  BattleState,
  Phase,
  PlayerId,
} from '../../../shared/types/battle.types';
import { replayTo } from './engine/replay';
import { SimulatorBotCard, type FunctionEntry } from './simulator-bot-card';
import { PHASE_LABEL } from './simulator-play.utils';

const API_URL = 'https://firmware-wars-api.josepec.eu';

const BOT_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#fb923c',
  '#facc15', '#4ade80', '#60a5fa', '#f87171',
];

function buildBotColorMap(bots: BattleBot[]): Map<string, string> {
  const map = new Map<string, string>();
  bots.forEach((b, i) => map.set(b.id, BOT_COLORS[i % BOT_COLORS.length]));
  return map;
}

const PPT_EMOJI: Record<string, string> = {
  r: '✊', p: '✋', s: '✌',
  rock: '✊', paper: '✋', scissors: '✌',
};
const PPT_LABEL: Record<string, string> = {
  r: 'Piedra', p: 'Papel', s: 'Tijera',
  rock: 'Piedra', paper: 'Papel', scissors: 'Tijera',
};

const CRITERION_LABEL: Record<string, string> = {
  'junior-1': 'P1 es Junior',
  'junior-2': 'P2 es Junior',
  'ppt': 'PPT',
};

function describeEvent(ev: BattleEvent, bots: BattleBot[]): string {
  const p = ev.payload ?? {};
  const name = (id?: string) => bots.find(b => b.id === id)?.name ?? id ?? '';
  switch (ev.kind) {
    case 'deployed':
      return `Despliega en (${p['q']}, ${p['r']})`;
    case 'criterion_chosen': {
      const choice = (p['choice'] ?? p['criterion']) as string | undefined;
      return `Criterio elegido: ${choice ? (CRITERION_LABEL[choice] ?? choice) : '?'}`;
    }
    case 'ppt_rolled': {
      const hand = (p['hand'] ?? p['face']) as string | undefined;
      if (!hand) return `Tira PPT → ?`;
      return `Tira PPT → ${PPT_EMOJI[hand] ?? ''} ${PPT_LABEL[hand] ?? hand}`;
    }
    case 'ppt_tie': {
      const hands = p['hands'] as { 1?: string; 2?: string } | undefined;
      const a = hands?.[1] ?? '';
      return `Empate · ambos sacaron ${PPT_EMOJI[a] ?? ''} ${PPT_LABEL[a] ?? a}. Re-tirar.`;
    }
    case 'ppt_starter_set':
      return `Empieza el despliegue P${p['starter']}${p['reason'] ? ' (' + p['reason'] + ')' : ''}`;
    case 'color_rolled':
      return `Tira Dado de colores → ${p['color']}${p['player'] ? ' (P' + p['player'] + ')' : ''}`;
    case 'init_ppt': {
      const order = (p['activationOrder'] as string[] ?? []).map(id => {
        const b = bots.find(x => x.id === id);
        return b ? `P${b.playerId}` : '?';
      }).join(' → ');
      return `PPT ganador P${p['winner']} · orden: ${order}`;
    }
    case 'upgrade':
      return `Upgrade → V${p['version']}`;
    case 'boot_energy_rolled': {
      const chosen = p['chosen'] as number;
      if (chosen === 0) return `getEnergy(0) → sin dados · ${(p['energy'] ?? p['combined'] ?? 0)}⚡`;
      const dice = (p['dice'] as number[] ?? []).join('+');
      const combined = (p['combined'] ?? p['total']) as number;
      const overflow = p['overflow'] as boolean | undefined;
      if (overflow) return `getEnergy(${chosen}) → [${dice}] = ${combined} · almacenado ${combined} · +1 🐛`;
      return `getEnergy(${chosen}) → [${dice}] = ${combined}⚡`;
    }
    case 'boot_numbers_rolled': {
      const rolled = (p['rolled'] as number[] ?? []).join(', ');
      const nums = (p['numbers'] as number[] ?? []).join(', ');
      return `getNumbers() tira [${rolled}] → numbers: [${nums}]`;
    }
    case 'boot_operations_rolled': {
      const ops = (p['operations'] as string[] ?? []).join(', ');
      const slots = p['slots'];
      const bugs = p['bugs'];
      return `Operaciones (${slots} slots, ${bugs} bugs): [${ops}]`;
    }
    case 'compile_committed': {
      const ops = ((p['program'] as { operations?: Array<{ kind: string; primary?: { type: string; moveDistance?: number; attackFunctionId?: string }; secondary?: { type: string; moveDistance?: number; attackFunctionId?: string } | null; forCount?: number } > })?.operations ?? []);
      if (ops.length === 0) return `Programa compilado (vacío)`;
      const fmt = (fn: { type: string; moveDistance?: number; attackFunctionId?: string } | null | undefined) => {
        if (!fn) return '?';
        if (fn.type === 'move') return 'move()';
        if (fn.type === 'shield') return 'shield()';
        return `attack(${fn.attackFunctionId ?? '?'})`;
      };
      const opStrs = ops.map(o => {
        const prim = fmt(o.primary);
        const sec = o.secondary ? `/${fmt(o.secondary)}` : '';
        const cnt = o.forCount ? `×${o.forCount}` : '';
        return `${o.kind}${cnt}(${prim}${sec})`;
      });
      return `Programa (${ops.length} ops): [${opStrs.join(', ')}]`;
    }
    case 'operation_resolved': {
      if (p['skipped']) return `${p['kind'] ?? 'op'} saltada — sin números en RAM`;
      const kind = p['kind'] ?? '';
      const face = p['opFace'] as string | undefined;
      const compMap: Record<string, string> = { '<': '<', '<=': '≤', '>=': '≥', '>': '>', '!=': '≠', '==': '=' };
      const comp = face ? ` ${compMap[face] ?? face}` : '';
      const d6str = p['d6'] !== undefined ? ` d6:${p['d6']}` : '';
      const picked = p['picked'] !== undefined ? ` núm:${p['picked']}` : '';
      const diff = p['diff'] !== undefined ? ` diff:${p['diff']}` : '';
      const cond = p['condResult'] !== undefined ? ` = ${p['condResult'] ? 'TRUE' : 'FALSE'}` : '';
      const primary = p['primary'] as { type: string; moveDistance?: number; attackFunctionId?: string } | undefined;
      const secondary = p['secondary'] as { type: string; moveDistance?: number; attackFunctionId?: string } | null | undefined;
      const fmtFn = (fn: { type: string; moveDistance?: number; attackFunctionId?: string } | null | undefined) => {
        if (!fn) return null;
        if (fn.type === 'move') return 'move()';
        if (fn.type === 'shield') return 'shield()';
        return `attack(${fn.attackFunctionId ?? '?'})`;
      };
      const primStr = fmtFn(primary);
      const secStr = fmtFn(secondary);
      const fnPart = primStr ? ` → ${primStr}${secStr ? `/${secStr}` : ''}` : '';
      return `Op ${kind}${d6str}${comp}${picked}${diff}${cond}${fnPart}`;
    }
    case 'intercept': {
      const who = name(p['interceptorId'] as string);
      if (p['skipped']) return `${who} no intercepta`;
      return `${who} intercepta → sustituye d6 por ${p['substituteD6']}`;
    }
    case 'move':
      return `Mueve a (${p['toQ']}, ${p['toR']}) · -${p['energyCost'] ?? 0}⚡`;
    case 'attack_hit': {
      const tgt = name(p['targetId'] as string);
      const damage = (p['damage'] as number) ?? 0;
      const shield = (p['shieldConsumed'] as number) ?? 0;
      const energyCost = (p['energyCost'] as number) ?? 0;
      const baseDamage = p['baseDamage'] as number | undefined;
      let dmgStr = `${damage} daño`;
      if (baseDamage !== undefined && shield > 0) dmgStr = `${baseDamage} base → ${damage} neto (🛡-${shield})`;
      else if (shield > 0) dmgStr = `${damage} daño (🛡-${shield})`;
      return `Impacta a ${tgt} · ${dmgStr} · -${energyCost}⚡`;
    }
    case 'attack_miss':
      return `Ataque fallido · -${p['energyCost'] ?? 0}⚡`;
    case 'shield_up':
      return `Sube escudo +${p['amount'] ?? 1} · -${p['energyCost'] ?? 0}⚡`;
    case 'overload':
      return `OVERLOAD · -${p['lifeLoss'] ?? 0} life`;
    case 'bug_added':
      return `+${p['count'] ?? 1} BUG`;
    case 'bug_purged':
      return `Purga ${p['count'] ?? 1} BUG`;
    case 'destroyed':
      return `Destruido`;
    case 'debug_action':
      return `DEBUG: ${p['action'] ?? '?'}`;
    case 'status_applied': {
      const labels: Record<string, string> = { REBOOTING: 'REBOOT', LAG: 'LAG', SAFE_MODE: 'SAFE MODE', DMZ: 'DMZ' };
      const k = p['kind'] as string ?? '?';
      const rollStr = typeof p['roll'] === 'number' ? ` [d6: ${p['roll']}/${p['threshold'] ?? '?'}]` : '';
      return `Estado aplicado: ${labels[k] ?? k}${rollStr}${p['sourceFn'] ? ' (por ' + p['sourceFn'] + ')' : ''}`;
    }
    case 'status_resisted': {
      const labels: Record<string, string> = { REBOOTING: 'REBOOT', LAG: 'LAG', SAFE_MODE: 'SAFE MODE', DMZ: 'DMZ' };
      const k = p['kind'] as string ?? '?';
      const rollStr = typeof p['roll'] === 'number' ? ` [d6: ${p['roll']}/${p['threshold'] ?? '?'}]` : '';
      return `Estado resistido: ${labels[k] ?? k}${rollStr}${p['sourceFn'] ? ' (por ' + p['sourceFn'] + ')' : ''}`;
    }
    case 'status_expired': {
      const labels: Record<string, string> = { REBOOTING: 'REBOOT', LAG: 'LAG', SAFE_MODE: 'SAFE MODE', DMZ: 'DMZ' };
      const k = p['kind'] as string ?? '?';
      return `Estado eliminado: ${labels[k] ?? k}`;
    }
    case 'healed':
      return `Recupera ${p['amount'] ?? 0} ♥${p['sourceFn'] ? ' (por ' + p['sourceFn'] + ')' : ''}`;
    case 'moved':
      return `→ (${p['toQ']}, ${p['toR']})${p['sourceFn'] ? ' (por ' + p['sourceFn'] + ')' : ''}`;
    case 'buff_applied': {
      const buffLabels: Record<string, string> = { DAMAGE_PLUS_1: '+1 daño', DAMAGE_DOUBLE: 'x2 daño' };
      const k = p['kind'] as string ?? '?';
      return `Buff: ${buffLabels[k] ?? k}`;
    }
    case 'buff_consumed': {
      const buffLabels: Record<string, string> = { DAMAGE_PLUS_1: '+1 daño', DAMAGE_DOUBLE: 'x2 daño' };
      const k = p['kind'] as string ?? '?';
      return `Buff consumido: ${buffLabels[k] ?? k}`;
    }
    case 'numbers_lost':
      return `-${p['count'] ?? 1} numbers${p['sourceFn'] ? ' (por ' + p['sourceFn'] + ')' : ''}`;
    case 'entity_placed': {
      const e = p['entity'] as { kind?: string; q?: number; r?: number } | undefined;
      const kLabel: Record<string, string> = { barrier: 'Barrera', relay_node: 'Nodo Relay' };
      return `Coloca ${kLabel[e?.kind ?? ''] ?? e?.kind ?? '?'} en (${e?.q ?? '?'}, ${e?.r ?? '?'})`;
    }
    case 'entity_destroyed':
      return `Entidad destruida`;
    case 'phase_changed':
      if (p['reason'] === 'criteria-differ') return `Criterios distintos (P1: ${CRITERION_LABEL[p['c1'] as string] ?? p['c1']}, P2: ${CRITERION_LABEL[p['c2'] as string] ?? p['c2']}) → PPT`;
      return `Fase: ${p['from'] ?? '?'} → ${p['to'] ?? '?'}`;
    case 'turn_ended':
      return `Fin de turno`;
    case 'round_ended':
      return `Fin de ronda ${ev.turn}`;
    case 'victory':
      return `VICTORIA P${p['winner']}`;
    default:
      return ev.kind;
  }
}

@Component({
  selector: 'app-simulator-viewer',
  imports: [RouterLink, DatePipe, HexMap, SimulatorBotCard],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">

      <div class="mb-6">
        <a routerLink="/admin/simulator"
          class="text-[10px] tracking-[0.2em] text-green-500/50 hover:text-green-300">
          ← Volver a Battle Reports
        </a>
      </div>

      @if (loading()) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">> LOADING REPORT...</div>
      }

      @if (error()) {
        <div class="text-[10px] tracking-[0.2em] text-red-400/80">> {{ error() }}</div>
      }

      @if (report(); as r) {
        <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// BATTLE REPORT</div>
        <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase mb-2"
            style="font-family: 'Orbitron', monospace;">{{ r.title }}</h1>
        <div class="text-[10px] tracking-[0.2em] text-green-500/50 mb-6">
          {{ r.player1Alias }} vs {{ r.player2Alias }}
          &middot; {{ r.createdAt | date:'dd/MM/yyyy HH:mm' }}
          @if (r.status === 'finished' && r.winner) {
            &middot; <span class="text-green-400">Ganador: P{{ r.winner }}</span>
          }
        </div>

        <!-- Phase banner -->
        <div class="border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 mb-4 flex items-center gap-4">
          <div>
            <div class="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">Fase</div>
            <div class="text-base tracking-[0.15em] text-cyan-300 font-bold uppercase"
                 style="font-family: 'Orbitron', monospace;">
              {{ phaseLabel() }}
            </div>
          </div>
          <div class="border-l border-cyan-500/20 pl-4">
            <div class="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">Ronda</div>
            <div class="text-base text-cyan-300 font-bold">{{ currentState().turn }}</div>
          </div>
          <div class="border-l border-cyan-500/20 pl-4">
            <div class="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">Activación</div>
            <div class="text-base text-cyan-300 font-bold">
              {{ currentState().currentActivationIdx }} / {{ currentState().activationOrder.length }}
            </div>
          </div>
          @if (currentActivatingBot(); as cab) {
            <div class="border-l border-cyan-500/20 pl-4">
              <div class="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">Activo</div>
              <div class="text-base text-cyan-300 font-bold">{{ cab.name }} (P{{ cab.playerId }})</div>
            </div>
          }
          @if (currentEvent(); as ce) {
            <div class="ml-auto text-right">
              <div class="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">Último evento</div>
              <div class="text-[11px] text-cyan-200">{{ describe(ce) }}</div>
            </div>
          }
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          <div class="space-y-4">
            <div class="border border-green-500/15 bg-black/40 p-2">
              <app-hex-map [mapData]="displayMap()" [size]="28" />
            </div>

            <!-- Bot cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (pid of [1, 2]; track pid) {
                <div>
                  <div class="text-[9px] tracking-[0.3em] uppercase mb-2"
                       [class.text-cyan-400]="pid === 1"
                       [class.text-fuchsia-400]="pid === 2">
                    P{{ pid }} · {{ aliasOf(pid) }}
                  </div>
                  @if (selectedBotForView(pid); as sb) {
                    <app-simulator-bot-card
                      [bot]="sb"
                      [index]="selectedBotIdxFor(pid)"
                      [totalBots]="totalBotsFor(pid)"
                      [playerId]="$any(pid)"
                      [active]="false"
                      [expandedVersion]="expandedVersionFor(sb.id)"
                      [functionsMap]="functionsMap()"
                      (prev)="onBotPrev(pid)"
                      (next)="onBotNext(pid)"
                      (versionToggled)="toggleAttackVersion(sb.id, $event)" />
                  }
                </div>
              }
            </div>

            <!-- Timeline controls -->
            <div class="border border-green-500/15 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <button type="button" (click)="stepTo(0)" [disabled]="index() === 0"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase border border-green-500/20
                         text-green-500/60 hover:text-green-400 disabled:opacity-40 cursor-pointer">⏮</button>
                <button type="button" (click)="stepTo(index() - 1)" [disabled]="index() === 0"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase border border-green-500/20
                         text-green-500/60 hover:text-green-400 disabled:opacity-40 cursor-pointer">←</button>
                <button type="button" (click)="togglePlay()"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase border border-green-500/30
                         text-green-400 hover:bg-green-500/10 cursor-pointer">
                  @if (playing()) { Pausa } @else { Play }
                </button>
                <button type="button" (click)="stepTo(index() + 1)" [disabled]="index() >= r.events.length"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase border border-green-500/20
                         text-green-500/60 hover:text-green-400 disabled:opacity-40 cursor-pointer">→</button>
                <button type="button" (click)="stepTo(r.events.length)" [disabled]="index() >= r.events.length"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase border border-green-500/20
                         text-green-500/60 hover:text-green-400 disabled:opacity-40 cursor-pointer">⏭</button>
                <div class="ml-auto text-[9px] tracking-wider text-green-500/50">
                  Evento {{ index() }} / {{ r.events.length }}
                </div>
              </div>

              <input type="range" [min]="0" [max]="r.events.length" [value]="index()"
                (input)="stepTo(+$any($event.target).value)"
                class="w-full" />
            </div>
          </div>

          <!-- Log -->
          <aside class="border border-green-500/15 p-4 max-h-[82vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Log</div>
              <div class="text-[9px] tracking-wider text-green-500/40">
                {{ r.events.length }} eventos
              </div>
            </div>
            @if (r.events.length === 0) {
              <div class="text-[9px] tracking-wider text-green-500/40">
                Sin eventos. Esta partida no generó log (o el motor aún no está conectado).
              </div>
            }
            <ol class="space-y-1 text-[10px] font-mono">
              @for (ev of r.events; track $index; let i = $index) {
                <li class="px-2 py-1.5 border-l-2 transition-colors"
                    [class.border-green-400]="i === index() - 1"
                    [class.bg-green-500\\/10]="i === index() - 1"
                    [class.border-green-500\\/50]="i < index() - 1"
                    [class.text-green-300]="i < index()"
                    [class.border-green-500\\/10]="i >= index()"
                    [class.text-green-500\\/40]="i >= index()">
                  <div class="flex flex-wrap items-baseline gap-1.5">
                    <span class="text-green-500/50 text-[9px] tracking-wider">{{ turnLabel(ev) }}</span>
                    <span class="text-[8px] uppercase tracking-[0.15em] px-1 border"
                          [class.text-cyan-400\\/80]="ev.phase === 'deploy' || ev.phase === 'init'"
                          [class.border-cyan-500\\/30]="ev.phase === 'deploy' || ev.phase === 'init'"
                          [class.text-amber-300\\/80]="ev.phase === 'boot'"
                          [class.border-amber-500\\/30]="ev.phase === 'boot'"
                          [class.text-violet-300\\/80]="ev.phase === 'compile'"
                          [class.border-violet-500\\/30]="ev.phase === 'compile'"
                          [class.text-red-300\\/80]="ev.phase === 'run'"
                          [class.border-red-500\\/30]="ev.phase === 'run'"
                          [class.text-green-300\\/80]="ev.phase === 'debug' || ev.phase === 'end' || ev.phase === 'finished'"
                          [class.border-green-500\\/30]="ev.phase === 'debug' || ev.phase === 'end' || ev.phase === 'finished'">
                      {{ phaseLabelOf(ev.phase) }}
                    </span>
                    @if (actorOf(ev); as a) {
                      @if (a.player) {
                        <span class="text-[9px] font-bold"
                              [class.text-cyan-300]="a.player === 1"
                              [class.text-fuchsia-300]="a.player === 2">
                          P{{ a.player }}@if (a.alias) { · {{ a.alias }} }
                        </span>
                      }
                      @if (a.botName && a.botColor) {
                        <span class="text-[9px] px-1 border"
                              [style.color]="a.botColor"
                              [style.borderColor]="a.botColor + '55'">
                          {{ a.botName }}
                        </span>
                      }
                    }
                  </div>
                  <div class="text-[10px] mt-0.5">{{ describe(ev) }}</div>
                </li>
              }
            </ol>
          </aside>
        </div>
      }
    </div>
  `,
})
export class SimulatorViewer implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly route = inject(ActivatedRoute);

  report = signal<BattleReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  index = signal(0);
  playing = signal(false);
  selectedBotIdx = signal<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  expandedAttackVersion = signal<Record<string, 1 | 2 | 3 | null>>({});
  functionsMap = signal<Map<string, FunctionEntry>>(new Map());
  private playTimer: ReturnType<typeof setInterval> | null = null;

  readonly botColorMap = computed<Map<string, string>>(() =>
    buildBotColorMap(this.report()?.initialSnapshot.bots ?? [])
  );

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
    return replayTo(r.initialSnapshot, r.events as BattleEvent[], this.index());
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

  readonly currentEvent = computed<BattleEvent | null>(() => {
    const r = this.report();
    const i = this.index();
    if (!r || i <= 0) return null;
    return r.events[i - 1] ?? null;
  });

  readonly phaseLabel = computed(() => PHASE_LABEL[this.currentState().phase] ?? this.currentState().phase);

  readonly currentActivatingBot = computed<BattleBot | null>(() => {
    const s = this.currentState();
    const id = s.activationOrder[s.currentActivationIdx];
    if (!id) return null;
    return s.bots.find(b => b.id === id) ?? null;
  });

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
        'Función': string; 'V.~': string; 'Rango~': string; 'Daño~': string;
        'Energía~': string; 'Coste~': string; 'Efectos': string;
      }>;
      const map = new Map<string, FunctionEntry>();
      for (const r of raw) {
        const name = r['Función'].replace(/`/g, '');
        map.set(name, {
          id: name, func_name: name, func_type: 'attack',
          version: r['V.~'], range: r['Rango~'], damage: r['Daño~'],
          energy: r['Energía~'], cost: r['Coste~'], effects: r['Efectos'],
        });
      }
      this.functionsMap.set(map);
    } catch { /* ignore */ }
  }

  selectedBotForView(pid: number): BattleBot | null {
    const list = this.botsOf(pid);
    if (list.length === 0) return null;
    const idx = this.selectedBotIdx()[pid as PlayerId] ?? 0;
    return list[Math.max(0, Math.min(list.length - 1, idx))] ?? null;
  }

  selectedBotIdxFor(pid: number): number {
    return this.selectedBotIdx()[pid as PlayerId] ?? 0;
  }

  totalBotsFor(pid: number): number {
    return this.botsOf(pid).length;
  }

  expandedVersionFor(botId: string): 1 | 2 | 3 | null {
    return this.expandedAttackVersion()[botId] ?? null;
  }

  onBotPrev(pid: number): void {
    const total = this.totalBotsFor(pid);
    if (total <= 1) return;
    const cur = this.selectedBotIdxFor(pid);
    this.selectedBotIdx.update(s => ({ ...s, [pid]: (cur - 1 + total) % total }));
  }

  onBotNext(pid: number): void {
    const total = this.totalBotsFor(pid);
    if (total <= 1) return;
    const cur = this.selectedBotIdxFor(pid);
    this.selectedBotIdx.update(s => ({ ...s, [pid]: (cur + 1) % total }));
  }

  toggleAttackVersion(botId: string, v: 1 | 2 | 3): void {
    this.expandedAttackVersion.update(s => {
      const cur = s[botId] ?? null;
      return { ...s, [botId]: cur === v ? null : v };
    });
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/battles/${id}`, { headers: this.auth.authHeaders() });
      if (!resp.ok) {
        this.error.set(`API error ${resp.status}`);
      } else {
        this.report.set(await resp.json());
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.loading.set(false);
  }

  stepTo(i: number): void {
    const r = this.report();
    if (!r) return;
    const clamped = Math.max(0, Math.min(r.events.length, i));
    this.index.set(clamped);
  }

  togglePlay(): void {
    if (this.playing()) {
      this.playing.set(false);
      if (this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; }
      return;
    }
    this.playing.set(true);
    this.playTimer = setInterval(() => {
      const r = this.report();
      if (!r) return;
      if (this.index() >= r.events.length) {
        this.togglePlay();
        return;
      }
      this.stepTo(this.index() + 1);
    }, 600);
  }

  describe(ev: BattleEvent): string {
    return describeEvent(ev, this.currentState().bots);
  }

  botName(id: string): string {
    return this.currentState().bots.find(b => b.id === id)?.name ?? id;
  }

  aliasOf(pid: number): string {
    return this.currentState().players[pid as PlayerId]?.alias ?? '';
  }

  botsOf(pid: number): BattleBot[] {
    return this.currentState().bots.filter(b => b.playerId === pid);
  }

  shortPhase(phase: Phase): string {
    const map: Record<Phase, string> = {
      deploy: 'DEP', init: 'INI', boot: 'BOO', compile: 'CMP',
      run: 'RUN', debug: 'DBG', end: 'END', finished: 'FIN',
    };
    return map[phase] ?? phase;
  }

  phaseLabelOf(phase: Phase): string {
    return PHASE_LABEL[phase] ?? phase;
  }

  turnLabel(ev: BattleEvent): string {
    if (ev.turn === 0) return 'Setup';
    return `R${ev.turn}.${ev.activation}`;
  }

  actorOf(ev: BattleEvent): { player: PlayerId | null; alias: string; botName: string | null; botColor: string | null } | null {
    const r = this.report();
    let bot: BattleBot | undefined;
    if (ev.botId) {
      bot = this.currentState().bots.find(b => b.id === ev.botId)
        ?? r?.initialSnapshot.bots.find(b => b.id === ev.botId);
    }
    let pid: PlayerId | null = null;
    if (bot) pid = bot.playerId;
    else {
      const p = ev.payload ?? {};
      const fromPayload = (p['player'] ?? p['starter'] ?? p['winner']) as PlayerId | undefined;
      if (fromPayload === 1 || fromPayload === 2) pid = fromPayload;
    }
    if (pid === null && !bot) return null;
    const alias = pid && r ? (pid === 1 ? r.player1Alias : r.player2Alias) : '';
    return {
      player: pid,
      alias,
      botName: bot?.name ?? null,
      botColor: bot ? (this.botColorMap().get(bot.id) ?? BOT_COLORS[0]) : null,
    };
  }
}
