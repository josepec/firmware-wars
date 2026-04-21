import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import type { BattleEvent, BattleReport, BattleState } from '../../../shared/types/battle.types';
import { replayTo } from './engine/replay';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-simulator-viewer',
  imports: [RouterLink, DatePipe, HexMap],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">

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

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          <div class="space-y-4">
            <div class="border border-green-500/15 bg-black/40 p-2">
              <app-hex-map [mapData]="currentState().hexMap" [size]="28" />
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
          <aside class="border border-green-500/15 p-4 max-h-[72vh] overflow-y-auto">
            <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase mb-3">Log</div>
            @if (r.events.length === 0) {
              <div class="text-[9px] tracking-wider text-green-500/40">
                Sin eventos. Esta partida no generó log (o el motor aún no está conectado).
              </div>
            }
            <ol class="space-y-1 text-[10px] tracking-wider font-mono">
              @for (ev of r.events; track $index; let i = $index) {
                <li class="px-2 py-1 border-l-2"
                    [class.border-green-400\\/60]="i < index()"
                    [class.border-green-500\\/10]="i >= index()"
                    [class.text-green-300]="i < index()"
                    [class.text-green-500\\/40]="i >= index()">
                  <span class="text-green-500/50">T{{ ev.turn }}.{{ ev.activation }}</span>
                  <span class="mx-1 text-green-500/30">·</span>
                  <span class="uppercase">{{ ev.kind }}</span>
                  @if (ev.botId) {
                    <span class="ml-1 text-green-500/50">({{ ev.botId }})</span>
                  }
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
}
