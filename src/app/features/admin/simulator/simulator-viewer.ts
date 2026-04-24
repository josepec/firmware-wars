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

const API_URL = 'https://firmware-wars-api.josepec.eu';

const PHASE_LABEL: Record<Phase, string> = {
  deploy: 'DESPLIEGUE',
  init: 'INIT · PPT',
  boot: 'BOOT',
  compile: 'COMPILE',
  run: 'RUN',
  debug: 'DEBUG',
  end: 'END',
  finished: 'FIN',
};

const PPT_EMOJI: Record<string, string> = { r: '✊', p: '✋', s: '✌' };
const PPT_LABEL: Record<string, string> = { r: 'Piedra', p: 'Papel', s: 'Tijera' };

function describeEvent(ev: BattleEvent, bots: BattleBot[]): string {
  const p = ev.payload ?? {};
  const name = (id?: string) => bots.find(b => b.id === id)?.name ?? id ?? '';
  switch (ev.kind) {
    case 'deployed':
      return `Despliega en (${p['q']}, ${p['r']})`;
    case 'criterion_chosen':
      return `Criterio elegido: ${p['criterion'] ?? '?'}`;
    case 'ppt_rolled': {
      const face = p['face'] as string;
      return `Tira PPT → ${PPT_EMOJI[face] ?? ''} ${PPT_LABEL[face] ?? face}`;
    }
    case 'ppt_starter_set':
      return `Inicia el despliegue P${p['starter']}`;
    case 'color_rolled':
      return `Dado de colores → ${p['color']}`;
    case 'init_ppt':
      return `PPT ganador P${p['winner']} · orden: ${(p['activationOrder'] as string[] ?? []).map(id => name(id)).join(' → ')}`;
    case 'upgrade':
      return `Upgrade → V${p['version']}`;
    case 'boot_energy_rolled':
      return `Energía tirada: ${p['energy']}`;
    case 'boot_numbers_rolled':
      return `Numbers: [${(p['numbers'] as number[] ?? []).join(', ')}]`;
    case 'boot_operations_rolled':
      return `Operaciones: [${(p['operations'] as string[] ?? []).join(', ')}]`;
    case 'compile_committed':
      return `Programa compilado (${((p['program'] as { operations?: unknown[] })?.operations?.length ?? 0)} ops)`;
    case 'operation_resolved':
      return `Operación ${p['kind'] ?? ''} → ${p['branch'] ?? ''}`;
    case 'intercept':
      return `Intercepta → ${name(p['interceptorId'] as string)}`;
    case 'move':
      return `Mueve a (${p['toQ']}, ${p['toR']}) · -${p['energyCost'] ?? 0}⚡`;
    case 'attack_hit': {
      const tgt = name(p['targetId'] as string);
      return `Impacta a ${tgt} · ${p['damage'] ?? 0} daño (escudo -${p['shieldConsumed'] ?? 0}) · -${p['energyCost'] ?? 0}⚡`;
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
  imports: [RouterLink, DatePipe, HexMap],
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

            <!-- Bots -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              @for (pid of [1, 2]; track pid) {
                <div class="border p-3"
                     [class.border-cyan-500\\/30]="pid === 1"
                     [class.bg-cyan-500\\/5]="pid === 1"
                     [class.border-fuchsia-500\\/30]="pid === 2"
                     [class.bg-fuchsia-500\\/5]="pid === 2">
                  <div class="text-[9px] tracking-[0.3em] uppercase mb-2"
                       [class.text-cyan-400]="pid === 1"
                       [class.text-fuchsia-400]="pid === 2">
                    P{{ pid }} · {{ aliasOf(pid) }}
                  </div>
                  <div class="space-y-2">
                    @for (b of botsOf(pid); track b.id) {
                      <div class="border border-white/10 bg-black/40 px-2 py-1.5 text-[10px]"
                           [class.opacity-40]="b.destroyed">
                        <div class="flex items-center justify-between">
                          <span class="font-bold text-green-300">{{ b.name }}</span>
                          <span class="text-[9px] text-green-500/50">V{{ b.version }}</span>
                        </div>
                        <div class="flex gap-3 text-[9px] text-green-500/70 mt-0.5">
                          <span>❤ {{ b.life }}/{{ b.maxLife }}</span>
                          <span>⚡ {{ b.energy }}/{{ b.maxEnergy }}</span>
                          <span>🛡 {{ b.shield }}/{{ b.maxShield }}</span>
                          @if (b.bugs > 0) { <span class="text-red-400">🐛 {{ b.bugs }}</span> }
                          @if (b.destroyed) { <span class="text-red-500">✖ destruido</span> }
                        </div>
                        @if (b.numbers.length > 0) {
                          <div class="text-[9px] text-green-500/60 mt-0.5">
                            numbers: [{{ b.numbers.join(', ') }}]
                          </div>
                        }
                        @if (b.pendingOperations.length > 0) {
                          <div class="text-[9px] text-green-500/60">
                            ops: [{{ b.pendingOperations.join(', ') }}]
                          </div>
                        }
                        @if (b.compiledProgram) {
                          <div class="text-[9px] text-cyan-400/80">
                            compilado: {{ b.compiledProgram.operations.length }} op(s)
                          </div>
                        }
                      </div>
                    }
                  </div>
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
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-green-500/50 text-[9px]">T{{ ev.turn }}.{{ ev.activation }}</span>
                    <span class="text-[8px] uppercase tracking-wider text-cyan-500/60">{{ shortPhase(ev.phase) }}</span>
                    @if (ev.botId; as bid) {
                      <span class="text-[9px] text-green-500/60">· {{ botName(bid) }}</span>
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
  private playTimer: ReturnType<typeof setInterval> | null = null;

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
}
