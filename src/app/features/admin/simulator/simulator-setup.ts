import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import type { BattleState, PlayerId } from '../../../shared/types/battle.types';
import { hexKey } from '../../../shared/types/battle.types';
import type { HexCell, HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import { DEFAULT_HEX_TYPES } from '../../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ScenarioSummary {
  id: string;
  title: string;
  data?: { hexMap?: HexMapData };
  updated_at: string;
}

type Source = 'scenario' | 'custom';

@Component({
  selector: 'app-simulator-setup',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">

      <div class="mb-6">
        <a routerLink="/admin/simulator"
          class="text-[10px] tracking-[0.2em] text-green-500/50 hover:text-green-300">
          ← Volver
        </a>
      </div>

      <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN · SIMULADOR</div>
      <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase mb-8"
          style="font-family: 'Orbitron', monospace;">Nueva partida</h1>

      <!-- Steps indicator -->
      <div class="flex items-center gap-2 mb-8 text-[9px] tracking-[0.2em] uppercase">
        @for (s of [1,2,3]; track s) {
          <span [class.text-green-400]="step() === s"
                [class.text-green-500\\/30]="step() !== s">
            {{ s }}. {{ stepLabel(s) }}
          </span>
          @if (s < 3) { <span class="text-green-500/20">→</span> }
        }
      </div>

      <div class="border border-green-500/15 p-6 space-y-6">

        <!-- STEP 1: Map ──────────────────────────────────────────── -->
        @if (step() === 1) {
          <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Origen del mapa</div>

          <div class="flex gap-3">
            <button type="button" (click)="source.set('scenario')"
              class="flex-1 py-3 text-[10px] tracking-[0.2em] uppercase border transition-all"
              [class.border-green-400\\/50]="source() === 'scenario'"
              [class.bg-green-500\\/10]="source() === 'scenario'"
              [class.text-green-400]="source() === 'scenario'"
              [class.border-green-500\\/20]="source() !== 'scenario'"
              [class.text-green-500\\/50]="source() !== 'scenario'">
              Escenario existente
            </button>
            <button type="button" (click)="source.set('custom')"
              class="flex-1 py-3 text-[10px] tracking-[0.2em] uppercase border transition-all"
              [class.border-green-400\\/50]="source() === 'custom'"
              [class.bg-green-500\\/10]="source() === 'custom'"
              [class.text-green-400]="source() === 'custom'"
              [class.border-green-500\\/20]="source() !== 'custom'"
              [class.text-green-500\\/50]="source() !== 'custom'">
              Mapa rectangular
            </button>
          </div>

          @if (source() === 'scenario') {
            <div>
              <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Escenario</label>
              <select [(ngModel)]="scenarioId"
                class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                       focus:border-green-400/50 focus:outline-none">
                <option value="">— Selecciona —</option>
                @for (s of scenarios(); track s.id) {
                  <option [value]="s.id">{{ s.title }}</option>
                }
              </select>
              <div class="mt-2 text-[9px] text-green-500/35 tracking-wider">
                Solo se usará el mapa y las zonas de despliegue. Amenazas, objetivos y condiciones del escenario se ignoran — Victoria siempre por aniquilación.
              </div>
            </div>
          }

          @if (source() === 'custom') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Ancho (cols)</label>
                <input type="number" min="8" max="30" [(ngModel)]="customCols"
                  class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                         focus:border-green-400/50 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Alto (filas)</label>
                <input type="number" min="8" max="30" [(ngModel)]="customRows"
                  class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                         focus:border-green-400/50 focus:outline-none" />
              </div>
            </div>
            <div class="text-[9px] text-green-500/35 tracking-wider">
              Tablero rectangular sin obstáculos. Las zonas de despliegue serán las dos filas extremas.
              Un editor completo de mapas queda fuera de v1.
            </div>
          }
        }

        <!-- STEP 2: Army Lists ──────────────────────────────────── -->
        @if (step() === 2) {
          <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Listas de Bots</div>
          <div class="text-[9px] text-green-500/35 tracking-wider">
            Pega los IDs de dos listas creadas en el Army Builder.
          </div>

          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">List1 ID (P1)</label>
            <input type="text" [(ngModel)]="list1Id"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300 font-mono
                     focus:border-green-400/50 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">List2 ID (P2)</label>
            <input type="text" [(ngModel)]="list2Id"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300 font-mono
                     focus:border-green-400/50 focus:outline-none" />
          </div>
        }

        <!-- STEP 3: Aliases ─────────────────────────────────────── -->
        @if (step() === 3) {
          <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Programadores</div>

          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Título de la partida</label>
            <input type="text" [(ngModel)]="title"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                     focus:border-green-400/50 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Alias P1</label>
            <input type="text" [(ngModel)]="player1Alias"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                     focus:border-green-400/50 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Alias P2</label>
            <input type="text" [(ngModel)]="player2Alias"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                     focus:border-green-400/50 focus:outline-none" />
          </div>
        }

        @if (error()) {
          <div class="text-[10px] tracking-[0.2em] text-red-400/80">> {{ error() }}</div>
        }

        <!-- Nav ─────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between pt-4 border-t border-green-500/10">
          <button type="button" (click)="prev()" [disabled]="step() === 1"
            class="px-4 py-2 text-[10px] tracking-[0.2em] uppercase
                   border border-green-500/20 text-green-500/50
                   hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            ← Atrás
          </button>
          @if (step() < 3) {
            <button type="button" (click)="next()" [disabled]="!canAdvance()"
              class="px-4 py-2 text-[10px] tracking-[0.2em] uppercase
                     bg-green-500/10 border border-green-500/30 text-green-400
                     hover:bg-green-500/20 hover:border-green-400/50 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              Siguiente →
            </button>
          } @else {
            <button type="button" (click)="create()" [disabled]="!canCreate() || creating()"
              class="px-4 py-2 text-[10px] tracking-[0.2em] uppercase
                     bg-green-500/10 border border-green-500/30 text-green-400
                     hover:bg-green-500/20 hover:border-green-400/50 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            @if (creating()) { CREANDO... } @else { Crear partida }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class SimulatorSetup implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);

  step = signal<1 | 2 | 3>(1);
  source = signal<Source>('scenario');
  scenarios = signal<ScenarioSummary[]>([]);
  scenarioId = '';
  customCols = 14;
  customRows = 10;
  list1Id = '';
  list2Id = '';
  title = '';
  player1Alias = 'P1';
  player2Alias = 'P2';
  error = signal<string | null>(null);
  creating = signal(false);

  readonly selectedScenario = computed(() =>
    this.scenarios().find(s => s.id === this.scenarioId),
  );

  ngOnInit() {
    this.loadScenarios();
  }

  async loadScenarios(): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/scenarios?full=1`);
      if (resp.ok) this.scenarios.set(await resp.json());
    } catch { /* ignore */ }
  }

  stepLabel(s: number): string {
    return s === 1 ? 'Mapa' : s === 2 ? 'Listas' : 'Programadores';
  }

  canAdvance(): boolean {
    if (this.step() === 1) {
      return this.source() === 'scenario' ? !!this.scenarioId : this.customCols > 0 && this.customRows > 0;
    }
    if (this.step() === 2) {
      return !!this.list1Id.trim() && !!this.list2Id.trim();
    }
    return true;
  }

  canCreate(): boolean {
    return this.canAdvance() && !!this.title.trim() && !!this.player1Alias.trim() && !!this.player2Alias.trim();
  }

  next() {
    if (this.canAdvance() && this.step() < 3) {
      this.step.set((this.step() + 1) as 1 | 2 | 3);
    }
  }

  prev() {
    if (this.step() > 1) {
      this.step.set((this.step() - 1) as 1 | 2 | 3);
    }
  }

  async create(): Promise<void> {
    this.error.set(null);
    this.creating.set(true);
    try {
      const [list1, list2] = await Promise.all([
        fetch(`${API_URL}/api/lists/${this.list1Id.trim()}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/lists/${this.list2Id.trim()}`).then(r => r.ok ? r.json() : null),
      ]);
      if (!list1 || !list2) {
        this.error.set('No se pudo cargar alguna de las listas. Comprueba los IDs.');
        this.creating.set(false);
        return;
      }

      const { hexMap, zones } = this.buildMap();
      const initialSnapshot = this.buildInitialSnapshot(hexMap, zones);

      const resp = await fetch(`${API_URL}/api/battles`, {
        method: 'POST',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({
          title: this.title.trim(),
          scenarioId: this.source() === 'scenario' ? this.scenarioId : null,
          list1Id: this.list1Id.trim(),
          list2Id: this.list2Id.trim(),
          player1Alias: this.player1Alias.trim(),
          player2Alias: this.player2Alias.trim(),
          initialSnapshot,
        }),
      });
      if (!resp.ok) {
        this.error.set(`API error ${resp.status}`);
        this.creating.set(false);
        return;
      }
      const { id } = await resp.json();
      this.router.navigate(['/admin/simulator/play', id]);
    } catch (e) {
      this.error.set(String(e));
      this.creating.set(false);
    }
  }

  private buildMap(): { hexMap: HexMapData; zones: { team1: string[]; team2: string[] } } {
    if (this.source() === 'scenario') {
      const src = this.selectedScenario()?.data?.hexMap;
      const map: HexMapData = src
        ? { hexTypes: src.hexTypes ?? [...DEFAULT_HEX_TYPES], hexes: src.hexes ?? [], deployments: src.deployments ?? [] }
        : { hexTypes: [...DEFAULT_HEX_TYPES], hexes: [], deployments: [] };
      const zones = this.extractZonesFromDeployments(map);
      return { hexMap: { ...map, deployments: [] }, zones };
    }
    return this.buildRectangularMap(this.customCols, this.customRows);
  }

  private extractZonesFromDeployments(map: HexMapData): { team1: string[]; team2: string[] } {
    const team1: string[] = [];
    const team2: string[] = [];
    for (const d of map.deployments ?? []) {
      if (d.type !== 'player') continue;
      const key = hexKey(d.q, d.r);
      if (d.team === 1) team1.push(key);
      else if (d.team === 2) team2.push(key);
    }
    // Fallback: si el escenario no marcó zonas de player, usar dot colors o nada.
    return { team1, team2 };
  }

  private buildRectangularMap(cols: number, rows: number): { hexMap: HexMapData; zones: { team1: string[]; team2: string[] } } {
    const hexes: HexCell[] = [];
    const team1: string[] = [];
    const team2: string[] = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const q = col;
        const r = row - Math.floor(col / 2);
        hexes.push({ q, r, typeId: 'normal' });
        const k = hexKey(q, r);
        if (row === 0) team1.push(k);
        if (row === rows - 1) team2.push(k);
      }
    }
    return {
      hexMap: { hexTypes: [...DEFAULT_HEX_TYPES], hexes, deployments: [] },
      zones: { team1, team2 },
    };
  }

  private buildInitialSnapshot(hexMap: HexMapData, zones: { team1: string[]; team2: string[] }): BattleState {
    const players: BattleState['players'] = {
      1: { alias: this.player1Alias.trim(), listId: this.list1Id.trim() },
      2: { alias: this.player2Alias.trim(), listId: this.list2Id.trim() },
    };
    return {
      id: '',
      status: 'in_progress',
      phase: 'deploy',
      turn: 0,
      activationOrder: [],
      currentActivationIdx: 0,
      cpuPriority: 1 as PlayerId,
      players,
      bots: [],
      hexMap,
      deploymentZones: zones,
    };
  }
}
