import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AdminAuth } from '../../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface FormatStats {
  count: number;
  avgRounds: number;
  winP1: number; winP2: number; draw: number;
  roundDist: number[];
  deathsByRound: number[];
  firstDeathByRound: number[];
  avgDamageByRound: number[];
  bugsAddedByRound: number[];
}

interface StatsResponse {
  total: number;
  '1v1': FormatStats;
  '2v2': FormatStats;
}

interface BarGroup {
  label: string;
  x1: number; h1: number;
  x2: number; h2: number;
  bw: number; xl: number;
}

interface ChartSet {
  roundDist: BarGroup[];    maxRoundDist: number;
  deaths: BarGroup[];       maxDeaths: number;
  firstDeath: BarGroup[];   maxFirstDeath: number;
  damage: BarGroup[];       maxDamage: number;
  bugs: BarGroup[];         maxBugs: number;
}

@Component({
  selector: 'app-simulator-battle-stats',
  imports: [NgTemplateOutlet],
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
            > No hay suficientes datos todavía.
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
          <div class="flex items-center gap-4 mb-4 text-[8px] tracking-[0.15em]">
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-2 inline-block" style="background:rgba(34,211,238,0.65)"></span>
              <span class="text-cyan-400/60">1v1</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-2 inline-block" style="background:rgba(232,121,249,0.65)"></span>
              <span class="text-fuchsia-400/60">2v2</span>
            </span>
          </div>

          <!-- Charts -->
          @if (charts(); as c) {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

              <ng-container *ngTemplateOutlet="chartTpl; context:{
                title:'DURACIÓN (RONDAS POR PARTIDA)', bars:c.roundDist, maxV:c.maxRoundDist
              }"></ng-container>

              <ng-container *ngTemplateOutlet="chartTpl; context:{
                title:'MUERTES POR RONDA', bars:c.deaths, maxV:c.maxDeaths
              }"></ng-container>

              <ng-container *ngTemplateOutlet="chartTpl; context:{
                title:'PRIMERA MUERTE (RONDA)', bars:c.firstDeath, maxV:c.maxFirstDeath
              }"></ng-container>

              <ng-container *ngTemplateOutlet="chartTpl; context:{
                title:'DAÑO PROMEDIO POR RONDA', bars:c.damage, maxV:c.maxDamage
              }"></ng-container>

              @if (c.maxBugs > 0) {
                <ng-container *ngTemplateOutlet="chartTpl; context:{
                  title:'BUGS AÑADIDOS POR RONDA', bars:c.bugs, maxV:c.maxBugs
                }"></ng-container>
              }

            </div>
          }

        }
      }
    </div>

    <ng-template #chartTpl let-title="title" let-bars="bars" let-maxV="maxV">
      <div>
        <div class="text-[8px] tracking-[0.15em] text-green-500/35 mb-1.5">// {{title}}</div>
        <div class="bg-black/25 border border-green-500/10 p-3">
          <svg viewBox="0 0 300 100" class="w-full" preserveAspectRatio="xMinYMin meet">
            <line x1="25" y1="5"  x2="295" y2="5"  stroke="rgba(34,211,238,0.05)" stroke-width="0.5"/>
            <line x1="25" y1="43" x2="295" y2="43" stroke="rgba(34,211,238,0.05)" stroke-width="0.5"/>
            <line x1="25" y1="80" x2="295" y2="80" stroke="rgba(34,211,238,0.12)" stroke-width="0.5"/>
            <text x="22" y="9"  text-anchor="end" font-size="6" fill="rgba(34,211,238,0.3)" font-family="monospace">{{fmt(maxV)}}</text>
            <text x="22" y="47" text-anchor="end" font-size="6" fill="rgba(34,211,238,0.3)" font-family="monospace">{{fmt(maxV/2)}}</text>
            <text x="22" y="83" text-anchor="end" font-size="6" fill="rgba(34,211,238,0.3)" font-family="monospace">0</text>
            @for (b of bars; track $index) {
              @if (b.h1 > 0) {
                <rect [attr.x]="b.x1" [attr.y]="80-b.h1" [attr.width]="b.bw" [attr.height]="b.h1" fill="#22d3ee" fill-opacity="0.6"/>
                <rect [attr.x]="b.x1" [attr.y]="80-b.h1" [attr.width]="b.bw" height="1" fill="#22d3ee" fill-opacity="0.9"/>
              }
              @if (b.h2 > 0) {
                <rect [attr.x]="b.x2" [attr.y]="80-b.h2" [attr.width]="b.bw" [attr.height]="b.h2" fill="#e879f9" fill-opacity="0.6"/>
                <rect [attr.x]="b.x2" [attr.y]="80-b.h2" [attr.width]="b.bw" height="1" fill="#e879f9" fill-opacity="0.9"/>
              }
              <text [attr.x]="b.xl" y="93" text-anchor="middle" font-size="5.5"
                    fill="rgba(34,211,238,0.35)" font-family="monospace">{{b.label}}</text>
            }
          </svg>
        </div>
      </div>
    </ng-template>
  `,
})
export class SimulatorBattleStats implements OnInit {
  private readonly auth = inject(AdminAuth);

  stats = signal<StatsResponse | null>(null);
  loading = signal(false);

  readonly charts = computed((): ChartSet | null => {
    const s = this.stats();
    if (!s) return null;
    const v1 = s['1v1'];
    const v2 = s['2v2'];
    return {
      roundDist:  this.makeBars(v1.roundDist, v2.roundDist),
      maxRoundDist: this.cmax(v1.roundDist, v2.roundDist),
      deaths:     this.makeBars(v1.deathsByRound, v2.deathsByRound),
      maxDeaths:  this.cmax(v1.deathsByRound, v2.deathsByRound),
      firstDeath: this.makeBars(v1.firstDeathByRound, v2.firstDeathByRound),
      maxFirstDeath: this.cmax(v1.firstDeathByRound, v2.firstDeathByRound),
      damage:     this.makeBars(v1.avgDamageByRound, v2.avgDamageByRound),
      maxDamage:  this.cmax(v1.avgDamageByRound, v2.avgDamageByRound),
      bugs:       this.makeBars(v1.bugsAddedByRound, v2.bugsAddedByRound),
      maxBugs:    this.cmax(v1.bugsAddedByRound, v2.bugsAddedByRound),
    };
  });

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const r = await fetch(`${API_URL}/api/battles/stats`, { headers: this.auth.authHeaders() });
      if (r.ok) this.stats.set(await r.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  private makeBars(d1: number[], d2: number[]): BarGroup[] {
    const n = Math.max(d1.length, d2.length, 1);
    const max = this.cmax(d1, d2);
    const groupW = 270 / n;
    const bw = Math.max(3, Math.min(12, groupW * 0.36));
    return Array.from({ length: n }, (_, i) => {
      const gx = 25 + i * groupW;
      const x1 = gx + groupW * 0.08;
      return {
        label: `R${i + 1}`,
        x1, h1: Math.round((d1[i] ?? 0) / max * 72),
        x2: x1 + bw + 2, h2: Math.round((d2[i] ?? 0) / max * 72),
        bw, xl: gx + groupW / 2,
      };
    });
  }

  private cmax(d1: number[], d2: number[]): number {
    return Math.max(...d1, ...d2, 1);
  }

  fmt(n: number): string {
    if (n === 0) return '0';
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  pct(wins: number, total: number): string {
    return total === 0 ? '—' : Math.round(wins / total * 100) + '%';
  }
}
