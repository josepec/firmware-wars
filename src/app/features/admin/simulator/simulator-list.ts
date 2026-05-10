import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import type { BattleReportSummary } from '../../../shared/types/battle.types';
import { SimulatorBattleStats } from './simulator-battle-stats';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-simulator-list',
  imports: [RouterLink, DatePipe, SimulatorBattleStats],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-5xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN · SIMULADOR</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Battle Reports</h1>
        </div>
        <a routerLink="/admin/simulator/new"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 hover:border-green-400/50 transition-all">
          + Nueva partida
        </a>
      </div>

      @if (loading()) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">
        > LOADING BATTLES...
      </div>
      }

      @if (!loading() && reports().length === 0) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">
        > No hay partidas registradas.
      </div>
      }

      @if (reports().length > 0) {
      <ul class="border border-green-500/15">
        @for (b of reports(); track b.id) {
        <li class="flex items-center justify-between px-5 py-4
                   border-b border-green-500/10 last:border-b-0
                   hover:bg-green-500/3 transition-colors">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-green-400 tracking-wider">{{ b.title }}</span>
              @if (b.status === 'finished') {
                <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                             border border-green-400/50 bg-green-500/10 text-green-300">
                  Finalizada
                </span>
              }
              @if (b.isDebug) {
                <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                             border border-orange-400/60 bg-orange-500/15 text-orange-300">
                  Debug
                </span>
              }
            </div>
            <div class="text-[9px] text-green-500/35 tracking-wider mt-0.5">
              {{ b.player1Alias }} vs {{ b.player2Alias }}
              &middot;
              @if (b.status === 'finished') {
                @if (b.winner) {
                  <span class="text-green-400/70">Ganador: P{{ b.winner }}</span>
                } @else {
                  <span>Empate</span>
                }
              } @else {
                <span class="text-yellow-400/60">En curso</span>
              }
              &middot; {{ b.createdAt | date:'dd/MM/yyyy HH:mm' }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (deleteConfirm() === b.id) {
              <span class="text-[9px] text-red-400/70 tracking-wider mr-1">CONFIRMAR?</span>
              <button (click)="deleteReport(b.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       bg-red-500/10 border border-red-500/30 text-red-400
                       hover:bg-red-500/20 transition-all cursor-pointer">
                Si
              </button>
              <button (click)="deleteConfirm.set(null)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 transition-all cursor-pointer">
                No
              </button>
            } @else {
              @if (b.status === 'in_progress') {
                <a [routerLink]="'/admin/simulator/play/' + b.id"
                  class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                         border border-yellow-500/30 text-yellow-400/80
                         hover:border-yellow-400/50 hover:text-yellow-300 transition-all">
                  Continuar
                </a>
              }
              <a [routerLink]="'/admin/simulator/view/' + b.id"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 hover:border-green-500/40 transition-all">
                Ver
              </a>
              <button (click)="deleteConfirm.set(b.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-red-500/15 text-red-500/40
                       hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">
                Borrar
              </button>
            }
          </div>
        </li>
        }
      </ul>
      }

      <app-simulator-battle-stats />

    </div>
  `,
})
export class SimulatorList implements OnInit {
  private readonly auth = inject(AdminAuth);

  reports = signal<BattleReportSummary[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  ngOnInit() {
    this.loadReports();
  }

  async loadReports(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/battles`, { headers: this.auth.authHeaders() });
      if (resp.ok) this.reports.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  async deleteReport(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/battles/${id}`, {
        method: 'DELETE',
        headers: this.auth.authHeaders(),
      });
      this.reports.update(list => list.filter(b => b.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
