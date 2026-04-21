import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import type { BattleState, PlayerId } from '../../../shared/types/battle.types';
import type { DotColor, HexCell, HexMapData } from '../../../shared/components/hex-map/hex-map.types';
import { DEFAULT_HEX_TYPES, DOT_COLORS } from '../../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ScenarioSummary {
  id: string;
  title: string;
  data?: { hexMap?: HexMapData };
  updated_at: string;
}

interface ListResponse {
  id: string;
  programmer: string;
  bots: unknown[];
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
              class="flex-1 py-3 text-[10px] tracking-[0.2em] uppercase border transition-all cursor-pointer"
              [class.border-green-400\\/50]="source() === 'scenario'"
              [class.bg-green-500\\/10]="source() === 'scenario'"
              [class.text-green-400]="source() === 'scenario'"
              [class.border-green-500\\/20]="source() !== 'scenario'"
              [class.text-green-500\\/50]="source() !== 'scenario'">
              Escenario existente
            </button>
            <button type="button" (click)="source.set('custom')"
              class="flex-1 py-3 text-[10px] tracking-[0.2em] uppercase border transition-all cursor-pointer"
              [class.border-green-400\\/50]="source() === 'custom'"
              [class.bg-green-500\\/10]="source() === 'custom'"
              [class.text-green-400]="source() === 'custom'"
              [class.border-green-500\\/20]="source() !== 'custom'"
              [class.text-green-500\\/50]="source() !== 'custom'">
              Eliminación total (custom)
            </button>
          </div>

          @if (source() === 'scenario') {
            <div>
              <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Escenario</label>
              <div class="relative">
                <button type="button" (click)="scenarioOpen.set(!scenarioOpen())"
                  class="w-full flex items-center justify-between px-3 py-2 text-sm
                         bg-green-500/5 border border-green-500/20 text-green-300
                         hover:border-green-400/50 focus:outline-none cursor-pointer">
                  <span [class.text-green-500\\/40]="!scenarioId">
                    {{ selectedScenario()?.title ?? '— Selecciona —' }}
                  </span>
                  <span class="text-green-500/60 text-xs">▼</span>
                </button>
                @if (scenarioOpen()) {
                  <div class="absolute left-0 right-0 top-full mt-1 z-10
                              bg-black border border-green-500/30 max-h-64 overflow-y-auto">
                    <button type="button" (click)="pickScenario('')"
                      class="w-full text-left px-3 py-2 text-sm text-green-500/40
                             hover:bg-green-500/10 cursor-pointer">
                      — Ninguno —
                    </button>
                    @for (s of scenarios(); track s.id) {
                      <button type="button" (click)="pickScenario(s.id)"
                        class="w-full text-left px-3 py-2 text-sm text-green-300
                               hover:bg-green-500/10 cursor-pointer"
                        [class.bg-green-500\\/10]="s.id === scenarioId">
                        {{ s.title }}
                      </button>
                    }
                  </div>
                }
              </div>
              <div class="mt-2 text-[9px] text-green-500/35 tracking-wider">
                Se usará el mapa y los colores del escenario. Amenazas, objetivos y condiciones se ignoran — Victoria siempre por aniquilación.
              </div>
            </div>
          }

          @if (source() === 'custom') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Ancho (cols)</label>
                <input type="number" min="10" max="30" [(ngModel)]="customCols"
                  class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                         focus:border-green-400/50 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Alto (filas)</label>
                <input type="number" min="10" max="30" [(ngModel)]="customRows"
                  class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                         focus:border-green-400/50 focus:outline-none" />
              </div>
            </div>
            <div class="text-[9px] text-green-500/35 tracking-wider leading-relaxed">
              Tablero rectangular con Hexes de los 5 Colores distribuidos aleatoriamente.
              El despliegue se resolverá en la fase deploy con tirada de Dado de Colores + perímetro de 6 Hexes (Eliminación Total, setup.md).
            </div>
          }
        }

        <!-- STEP 2: Army Lists ──────────────────────────────────── -->
        @if (step() === 2) {
          <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Listas de Bots</div>
          <div class="text-[9px] text-green-500/35 tracking-wider">
            Pega los IDs de dos listas del Army Builder. El alias del programador se cogerá de cada lista.
          </div>

          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">List1 ID (P1)</label>
            <input type="text" [(ngModel)]="list1Id" (ngModelChange)="onList1IdChange($event)"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300 font-mono
                     focus:border-green-400/50 focus:outline-none" />
            @if (list1Loading()) {
              <div class="mt-1 text-[9px] text-green-500/40 tracking-wider">> Cargando...</div>
            } @else if (list1Alias()) {
              <div class="mt-1 text-[9px] text-green-400/70 tracking-wider">
                > Programador: <span class="text-green-300">{{ list1Alias() }}</span>
              </div>
            } @else if (list1Error()) {
              <div class="mt-1 text-[9px] text-red-400/70 tracking-wider">> {{ list1Error() }}</div>
            }
          </div>
          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">List2 ID (P2)</label>
            <input type="text" [(ngModel)]="list2Id" (ngModelChange)="onList2IdChange($event)"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300 font-mono
                     focus:border-green-400/50 focus:outline-none" />
            @if (list2Loading()) {
              <div class="mt-1 text-[9px] text-green-500/40 tracking-wider">> Cargando...</div>
            } @else if (list2Alias()) {
              <div class="mt-1 text-[9px] text-green-400/70 tracking-wider">
                > Programador: <span class="text-green-300">{{ list2Alias() }}</span>
              </div>
            } @else if (list2Error()) {
              <div class="mt-1 text-[9px] text-red-400/70 tracking-wider">> {{ list2Error() }}</div>
            }
          </div>
        }

        <!-- STEP 3: Título y confirmar ───────────────────────────── -->
        @if (step() === 3) {
          <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Confirmación</div>

          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-2 uppercase">Título de la partida</label>
            <input type="text" [(ngModel)]="title"
              class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                     focus:border-green-400/50 focus:outline-none" />
          </div>

          <div class="space-y-1 text-[10px] tracking-wider pt-2 border-t border-green-500/10">
            <div class="text-green-500/50 uppercase tracking-[0.2em] mb-2">Resumen</div>
            <div><span class="text-green-500/50">Mapa:</span>
              <span class="text-green-300">
                {{ source() === 'scenario' ? (selectedScenario()?.title ?? '—') : ('Custom ' + customCols + 'x' + customRows) }}
              </span>
            </div>
            <div><span class="text-green-500/50">P1:</span>
              <span class="text-green-300">{{ list1Alias() || '—' }}</span>
              <span class="text-green-500/30"> · {{ list1Id }}</span>
            </div>
            <div><span class="text-green-500/50">P2:</span>
              <span class="text-green-300">{{ list2Alias() || '—' }}</span>
              <span class="text-green-500/30"> · {{ list2Id }}</span>
            </div>
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
  scenarioOpen = signal(false);
  customCols = 14;
  customRows = 12;
  list1Id = '';
  list2Id = '';
  list1Alias = signal('');
  list2Alias = signal('');
  list1Loading = signal(false);
  list2Loading = signal(false);
  list1Error = signal<string | null>(null);
  list2Error = signal<string | null>(null);
  title = '';
  error = signal<string | null>(null);
  creating = signal(false);

  private list1Timer: ReturnType<typeof setTimeout> | null = null;
  private list2Timer: ReturnType<typeof setTimeout> | null = null;

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

  pickScenario(id: string): void {
    this.scenarioId = id;
    this.scenarioOpen.set(false);
  }

  stepLabel(s: number): string {
    return s === 1 ? 'Mapa' : s === 2 ? 'Listas' : 'Confirmar';
  }

  canAdvance(): boolean {
    if (this.step() === 1) {
      return this.source() === 'scenario' ? !!this.scenarioId : this.customCols > 0 && this.customRows > 0;
    }
    if (this.step() === 2) {
      return !!this.list1Alias() && !!this.list2Alias();
    }
    return true;
  }

  canCreate(): boolean {
    return this.canAdvance() && !!this.title.trim();
  }

  next() {
    if (this.canAdvance() && this.step() < 3) {
      const nextStep = (this.step() + 1) as 1 | 2 | 3;
      this.step.set(nextStep);
      if (nextStep === 3 && !this.title.trim()) {
        const a = this.list1Alias() || 'P1';
        const b = this.list2Alias() || 'P2';
        this.title = `${a} vs ${b}`;
      }
    }
  }

  prev() {
    if (this.step() > 1) {
      this.step.set((this.step() - 1) as 1 | 2 | 3);
    }
  }

  onList1IdChange(v: string): void {
    this.list1Alias.set('');
    this.list1Error.set(null);
    if (this.list1Timer) clearTimeout(this.list1Timer);
    const id = v.trim();
    if (!id) return;
    this.list1Loading.set(true);
    this.list1Timer = setTimeout(() => this.fetchList(id, 1), 300);
  }

  onList2IdChange(v: string): void {
    this.list2Alias.set('');
    this.list2Error.set(null);
    if (this.list2Timer) clearTimeout(this.list2Timer);
    const id = v.trim();
    if (!id) return;
    this.list2Loading.set(true);
    this.list2Timer = setTimeout(() => this.fetchList(id, 2), 300);
  }

  private async fetchList(id: string, slot: 1 | 2): Promise<void> {
    const setLoading = slot === 1 ? this.list1Loading : this.list2Loading;
    const setAlias = slot === 1 ? this.list1Alias : this.list2Alias;
    const setError = slot === 1 ? this.list1Error : this.list2Error;
    try {
      const resp = await fetch(`${API_URL}/api/lists/${encodeURIComponent(id)}`);
      if (!resp.ok) {
        setError.set(`Lista no encontrada (${resp.status})`);
        setAlias.set('');
      } else {
        const data = (await resp.json()) as ListResponse;
        setAlias.set(data.programmer || '—');
      }
    } catch (e) {
      setError.set(String(e));
    } finally {
      setLoading.set(false);
    }
  }

  async create(): Promise<void> {
    this.error.set(null);
    this.creating.set(true);
    try {
      const hexMap = this.buildMap();
      const initialSnapshot = this.buildInitialSnapshot(hexMap);

      const resp = await fetch(`${API_URL}/api/battles`, {
        method: 'POST',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({
          title: this.title.trim(),
          scenarioId: this.source() === 'scenario' ? this.scenarioId : null,
          list1Id: this.list1Id.trim(),
          list2Id: this.list2Id.trim(),
          player1Alias: this.list1Alias(),
          player2Alias: this.list2Alias(),
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

  private buildMap(): HexMapData {
    if (this.source() === 'scenario') {
      const src = this.selectedScenario()?.data?.hexMap;
      if (!src) return { hexTypes: [...DEFAULT_HEX_TYPES], hexes: [], deployments: [] };
      return {
        hexTypes: src.hexTypes ?? [...DEFAULT_HEX_TYPES],
        hexes: src.hexes ?? [],
        deployments: src.deployments ?? [],
      };
    }
    return this.buildRectangularMap(this.customCols, this.customRows);
  }

  private buildRectangularMap(cols: number, rows: number): HexMapData {
    const hexes: HexCell[] = [];
    const palette: DotColor[] = DOT_COLORS.map(d => d.id);
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const q = col;
        const r = row - Math.floor(col / 2);
        const dot = palette[Math.floor(Math.random() * palette.length)];
        hexes.push({ q, r, typeId: 'normal', dot });
      }
    }
    return { hexTypes: [...DEFAULT_HEX_TYPES], hexes, deployments: [] };
  }

  private buildInitialSnapshot(hexMap: HexMapData): BattleState {
    const players: BattleState['players'] = {
      1: { alias: this.list1Alias(), listId: this.list1Id.trim() },
      2: { alias: this.list2Alias(), listId: this.list2Id.trim() },
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
    };
  }
}
