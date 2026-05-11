import { NgIf } from '@angular/common';
import {
  Component, ElementRef, OnDestroy, OnInit,
  ViewChild, effect, inject, signal,
} from '@angular/core';
import {
  BarController, BarElement, CategoryScale, Chart,
  LinearScale, Tooltip,
} from 'chart.js';
import { AdminAuth } from '../../../core/services/admin-auth';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const API_URL = 'https://firmware-wars-api.josepec.eu';

const C1 = { fill: 'rgba(34,211,238,0.75)', border: 'rgba(34,211,238,0.9)' };
const C2 = { fill: 'rgba(232,121,249,0.7)',  border: 'rgba(232,121,249,0.85)' };

interface FormatStats {
  count: number; avgRounds: number;
  winP1: number; winP2: number; draw: number;
  roundDist: number[]; deathsByRound: number[];
  firstDeathByRound: number[]; avgDamageByRound: number[];
  bugsAddedByRound: number[];
}

interface StatsResponse {
  total: number;
  '1v1': FormatStats;
  '2v2': FormatStats;
}

const CHART_OPTIONS: Chart['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 700 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(0,0,0,0.92)',
      borderColor: 'rgba(34,211,238,0.25)',
      borderWidth: 1,
      titleColor: '#22d3ee',
      bodyColor: 'rgba(34,211,238,0.65)',
      padding: 8,
      titleFont: { family: "'Orbitron', monospace", size: 9 } as never,
      bodyFont: { family: 'monospace', size: 9 } as never,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(34,211,238,0.05)' },
      border: { color: 'rgba(34,211,238,0.15)' },
      ticks: { color: 'rgba(34,211,238,0.45)', font: { family: 'monospace', size: 9 } as never },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(34,211,238,0.05)' },
      border: { color: 'transparent' },
      ticks: { color: 'rgba(34,211,238,0.45)', font: { family: 'monospace', size: 9 } as never, precision: 0 },
    },
  },
};

@Component({
  selector: 'app-simulator-battle-stats',
  imports: [NgIf],
  template: `
    <div class="mt-10 pt-6 border-t border-green-500/10">
      <div class="text-[10px] tracking-[0.3em] text-green-500/40 mb-1">// ESTADÍSTICAS</div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-sm tracking-[0.15em] text-green-400 font-bold uppercase"
            style="font-family:'Orbitron',monospace">Balance · Partidas Finalizadas</h2>
        <button (click)="load()" type="button"
          class="text-[8px] tracking-[0.15em] uppercase text-green-500/40
                 hover:text-green-400 transition-colors cursor-pointer">
          ↻ Recargar
        </button>
      </div>

      @if (loading()) {
        <div class="text-[9px] text-green-500/30 tracking-wider animate-pulse py-4">
          > CARGANDO ESTADÍSTICAS...
        </div>
      }

      @if (!loading() && stats(); as s) {

        @if (s.total === 0) {
          <div class="text-[9px] text-green-500/25 tracking-wider py-4">
            > No hay datos suficientes todavía.
          </div>
        } @else {

          <!-- Stat cards -->
          <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="bg-black/20 border border-green-500/15 px-4 py-3">
              <div class="text-[8px] tracking-[0.2em] text-green-500/35 mb-1">// TOTAL</div>
              <div class="text-2xl font-bold text-green-400" style="font-family:'Orbitron',monospace">{{s.total}}</div>
              <div class="text-[8px] text-green-500/30 mt-0.5">partidas sin debug</div>
            </div>
            <div class="bg-black/20 border border-cyan-500/20 px-4 py-3">
              <div class="text-[8px] tracking-[0.2em] text-cyan-500/50 mb-1">// 1v1</div>
              <div class="text-2xl font-bold text-cyan-400" style="font-family:'Orbitron',monospace">{{s['1v1'].count}}</div>
              <div class="text-[8px] text-cyan-500/30 mt-0.5">avg {{fmt(s['1v1'].avgRounds)}} rondas</div>
            </div>
            <div class="bg-black/20 border border-fuchsia-500/20 px-4 py-3">
              <div class="text-[8px] tracking-[0.2em] text-fuchsia-500/50 mb-1">// 2v2</div>
              <div class="text-2xl font-bold text-fuchsia-400" style="font-family:'Orbitron',monospace">{{s['2v2'].count}}</div>
              <div class="text-[8px] text-fuchsia-500/30 mt-0.5">avg {{fmt(s['2v2'].avgRounds)}} rondas</div>
            </div>
          </div>

          <!-- Win rates -->
          <div class="grid grid-cols-2 gap-2 mb-5">
            <div class="bg-black/20 border border-cyan-500/10 px-4 py-2.5">
              <div class="text-[8px] tracking-[0.15em] text-cyan-500/40 mb-1.5">// 1v1 VICTORIAS</div>
              @if (s['1v1'].count === 0) {
                <span class="text-[8px] text-green-500/25">—</span>
              } @else {
                <div class="flex flex-wrap gap-4 text-[10px] tracking-wider">
                  <span><span class="text-cyan-400/60">P1</span> <span class="text-cyan-300 font-bold">{{pct(s['1v1'].winP1, s['1v1'].count)}}</span></span>
                  <span><span class="text-fuchsia-400/60">P2</span> <span class="text-fuchsia-300 font-bold">{{pct(s['1v1'].winP2, s['1v1'].count)}}</span></span>
                  @if (s['1v1'].draw > 0) {
                    <span class="text-green-400/40">Empate {{pct(s['1v1'].draw, s['1v1'].count)}}</span>
                  }
                </div>
              }
            </div>
            <div class="bg-black/20 border border-fuchsia-500/10 px-4 py-2.5">
              <div class="text-[8px] tracking-[0.15em] text-fuchsia-500/40 mb-1.5">// 2v2 VICTORIAS</div>
              @if (s['2v2'].count === 0) {
                <span class="text-[8px] text-green-500/25">—</span>
              } @else {
                <div class="flex flex-wrap gap-4 text-[10px] tracking-wider">
                  <span><span class="text-cyan-400/60">P1</span> <span class="text-cyan-300 font-bold">{{pct(s['2v2'].winP1, s['2v2'].count)}}</span></span>
                  <span><span class="text-fuchsia-400/60">P2</span> <span class="text-fuchsia-300 font-bold">{{pct(s['2v2'].winP2, s['2v2'].count)}}</span></span>
                  @if (s['2v2'].draw > 0) {
                    <span class="text-green-400/40">Empate {{pct(s['2v2'].draw, s['2v2'].count)}}</span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Legend -->
          <div class="flex items-center gap-5 mb-4 text-[8px] tracking-[0.15em]">
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-2 inline-block rounded-sm" style="background:rgba(34,211,238,0.75)"></span>
              <span class="text-cyan-400/60">1v1</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-2 inline-block rounded-sm" style="background:rgba(232,121,249,0.7)"></span>
              <span class="text-fuchsia-400/60">2v2</span>
            </span>
          </div>

          <!-- Charts 2×2 grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// DURACIÓN (RONDAS POR PARTIDA)</div>
              <div class="bg-black/25 border border-green-500/10 p-3" style="height:170px">
                <canvas #roundDistCanvas></canvas>
              </div>
            </div>

            <div>
              <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// MUERTES POR RONDA</div>
              <div class="bg-black/25 border border-green-500/10 p-3" style="height:170px">
                <canvas #deathsCanvas></canvas>
              </div>
            </div>

            <div>
              <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// PRIMERA MUERTE (RONDA)</div>
              <div class="bg-black/25 border border-green-500/10 p-3" style="height:170px">
                <canvas #firstDeathCanvas></canvas>
              </div>
            </div>

            <div>
              <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// DAÑO PROMEDIO POR RONDA</div>
              <div class="bg-black/25 border border-green-500/10 p-3" style="height:170px">
                <canvas #damageCanvas></canvas>
              </div>
            </div>

            @if (s['1v1'].bugsAddedByRound.length > 0 || s['2v2'].bugsAddedByRound.length > 0) {
              <div class="md:col-span-2">
                <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// BUGS AÑADIDOS POR RONDA</div>
                <div class="bg-black/25 border border-green-500/10 p-3" style="height:170px">
                  <canvas #bugsCanvas></canvas>
                </div>
              </div>
            }

          </div>
        }
      }
    </div>
  `,
})
export class SimulatorBattleStats implements OnInit, OnDestroy {
  private readonly auth = inject(AdminAuth);

  @ViewChild('roundDistCanvas') roundDistRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('deathsCanvas')    deathsRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('firstDeathCanvas') firstDeathRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('damageCanvas')    damageRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bugsCanvas')      bugsRef?: ElementRef<HTMLCanvasElement>;

  stats = signal<StatsResponse | null>(null);
  loading = signal(false);

  private instances: Chart[] = [];

  constructor() {
    effect(() => {
      const s = this.stats();
      this.destroyAll();
      if (s && s.total > 0) {
        setTimeout(() => this.buildCharts(s), 0);
      }
    });
  }

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.destroyAll(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const r = await fetch(`${API_URL}/api/battles/stats`, { headers: this.auth.authHeaders() });
      if (r.ok) this.stats.set(await r.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  private buildCharts(s: StatsResponse): void {
    const v1 = s['1v1'];
    const v2 = s['2v2'];
    this.make(this.roundDistRef, this.labels(v1.roundDist, v2.roundDist, 'r'), v1.roundDist, v2.roundDist);
    this.make(this.deathsRef,    this.labels(v1.deathsByRound, v2.deathsByRound, 'R'), v1.deathsByRound, v2.deathsByRound);
    this.make(this.firstDeathRef, this.labels(v1.firstDeathByRound, v2.firstDeathByRound, 'R'), v1.firstDeathByRound, v2.firstDeathByRound);
    this.make(this.damageRef,    this.labels(v1.avgDamageByRound, v2.avgDamageByRound, 'R'), v1.avgDamageByRound, v2.avgDamageByRound);
    if (this.bugsRef) {
      this.make(this.bugsRef, this.labels(v1.bugsAddedByRound, v2.bugsAddedByRound, 'R'), v1.bugsAddedByRound, v2.bugsAddedByRound);
    }
  }

  private make(ref: ElementRef<HTMLCanvasElement> | undefined, labels: string[], d1: number[], d2: number[]): void {
    if (!ref?.nativeElement) return;
    const ctx = ref.nativeElement.getContext('2d')!;
    const n = labels.length;
    const g1 = ctx.createLinearGradient(0, 0, 0, 160);
    g1.addColorStop(0, 'rgba(34,211,238,0.75)'); g1.addColorStop(1, 'rgba(34,211,238,0.05)');
    const g2 = ctx.createLinearGradient(0, 0, 0, 160);
    g2.addColorStop(0, 'rgba(232,121,249,0.7)'); g2.addColorStop(1, 'rgba(232,121,249,0.05)');
    const pad = (arr: number[]) => [...arr, ...Array(Math.max(0, n - arr.length)).fill(0)];
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '1v1', data: pad(d1), backgroundColor: g1, borderColor: C1.border, borderWidth: 1, borderRadius: 2 },
          { label: '2v2', data: pad(d2), backgroundColor: g2, borderColor: C2.border, borderWidth: 1, borderRadius: 2 },
        ],
      },
      options: CHART_OPTIONS,
    });
    this.instances.push(chart);
  }

  private destroyAll(): void {
    this.instances.forEach(c => c.destroy());
    this.instances = [];
  }

  private labels(d1: number[], d2: number[], prefix: string): string[] {
    const n = Math.max(d1.length, d2.length);
    return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  }

  fmt(n: number): string {
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  pct(wins: number, total: number): string {
    return total === 0 ? '—' : Math.round(wins / total * 100) + '%';
  }
}
