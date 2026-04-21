import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import type { BattleReport } from '../../../shared/types/battle.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-simulator-play',
  imports: [RouterLink, HexMap],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">

      <div class="mb-6 flex items-center justify-between">
        <a routerLink="/admin/simulator"
          class="text-[10px] tracking-[0.2em] text-green-500/50 hover:text-green-300">
          ← Volver
        </a>
        @if (report(); as r) {
          <div class="text-[10px] tracking-[0.2em] text-green-500/50">
            {{ r.player1Alias }} vs {{ r.player2Alias }}
          </div>
        }
      </div>

      @if (loading()) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">> LOADING...</div>
      }

      @if (error()) {
        <div class="text-[10px] tracking-[0.2em] text-red-400/80">> {{ error() }}</div>
      }

      @if (report(); as r) {
        <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// PARTIDA</div>
        <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase mb-2"
            style="font-family: 'Orbitron', monospace;">{{ r.title }}</h1>
        <div class="text-[10px] tracking-[0.2em] text-green-500/50 mb-6">
          FASE: <span class="text-green-300">{{ r.initialSnapshot.phase }}</span>
          &middot; Ronda <span class="text-green-300">{{ r.initialSnapshot.turn }}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div class="border border-green-500/15 bg-black/40 p-2">
            <app-hex-map [mapData]="r.initialSnapshot.hexMap" [size]="28" />
          </div>

          <aside class="border border-green-500/15 p-4 space-y-3">
            <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Panel de fase</div>
            <div class="text-[9px] tracking-wider text-yellow-400/70">
              ⚠ Motor de juego en construcción. La fase actual se muestra informativa — las acciones
              (despliegue, BOOT, COMPILE, RUN, DEBUG, END) se conectarán al BattleEngine en próxima iteración.
              Consulta <code>README-simulator.md</code> para la hoja de ruta.
            </div>

            <div class="pt-3 border-t border-green-500/10 space-y-2">
              <button type="button" (click)="finish()" [disabled]="finishing()"
                class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                       bg-red-500/10 border border-red-500/30 text-red-400
                       hover:bg-red-500/20 transition-all
                       disabled:opacity-40 cursor-pointer">
                @if (finishing()) { CERRANDO... } @else { Cerrar partida }
              </button>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
})
export class SimulatorPlay implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  report = signal<BattleReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  finishing = signal(false);

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

  async finish(): Promise<void> {
    const r = this.report();
    if (!r) return;
    this.finishing.set(true);
    try {
      await fetch(`${API_URL}/api/battles/${r.id}/finish`, {
        method: 'PATCH',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ winner: null, finalState: r.initialSnapshot }),
      });
      this.router.navigate(['/admin/simulator']);
    } catch (e) {
      this.error.set(String(e));
    }
    this.finishing.set(false);
  }
}
