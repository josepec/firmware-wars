import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../../core/services/admin-auth';
import { HexMap } from '../../../shared/components/hex-map/hex-map';
import {
  DOT_COLORS,
  type DotColor,
  type HexMapData,
} from '../../../shared/components/hex-map/hex-map.types';
import {
  hexKey,
  type BattleBot,
  type BattleEvent,
  type BattleReport,
  type BattleState,
  type PlayerId,
} from '../../../shared/types/battle.types';
import { rollDadoColores } from './engine/dice';
import { hexDistance } from './engine/pathfinding';
import { replayTo } from './engine/replay';

const API_URL = 'https://firmware-wars-api.josepec.eu';
const DEPLOY_PERIMETER = 6;

const COLOR_HEX: Record<DotColor, string> = Object.fromEntries(
  DOT_COLORS.map(c => [c.id, c.hex]),
) as Record<DotColor, string>;

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
          FASE: <span class="text-green-300">{{ currentState().phase }}</span>
          &middot; Ronda <span class="text-green-300">{{ currentState().turn }}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div class="border border-green-500/15 bg-black/40 p-2">
            <app-hex-map [mapData]="displayMap()" [size]="28"
                         [interactive]="canPickHex()"
                         [selectable]="selectableHexes()"
                         [highlightedHexes]="highlightedHexes()"
                         [highlightColor]="highlightColor()"
                         (hexClicked)="onHexClick($event)" />
          </div>

          <aside class="border border-green-500/15 p-4 space-y-4">
            <div class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Panel de fase</div>

            @if (currentState().phase === 'deploy') {
              @if (!deployStarter()) {
                <div class="space-y-2">
                  <div class="text-[9px] tracking-wider text-green-500/60">
                    ¿Quién empieza el despliegue? (setup.md: Programador más Junior o PPT)
                  </div>
                  <div class="flex gap-2">
                    <button type="button" (click)="deployStarter.set(1)"
                      class="flex-1 py-2 text-[10px] tracking-[0.2em] uppercase
                             border border-green-500/20 text-green-500/60
                             hover:border-green-400/50 hover:text-green-400 cursor-pointer">
                      {{ r.player1Alias }}
                    </button>
                    <button type="button" (click)="deployStarter.set(2)"
                      class="flex-1 py-2 text-[10px] tracking-[0.2em] uppercase
                             border border-green-500/20 text-green-500/60
                             hover:border-green-400/50 hover:text-green-400 cursor-pointer">
                      {{ r.player2Alias }}
                    </button>
                  </div>
                </div>
              } @else if (activeDeployer(); as p) {
                <div class="space-y-3">
                  <div class="text-[9px] tracking-wider text-green-500/50">
                    Despliegue · Turno de
                    <span class="text-cyan-300">P{{ p }} · {{ aliasFor(p) }}</span>
                  </div>
                  <div class="text-[9px] text-green-500/40 tracking-wider">
                    {{ remainingFor(1) }} / {{ totalFor(1) }} de P1 ·
                    {{ remainingFor(2) }} / {{ totalFor(2) }} de P2 pendientes
                  </div>

                  @if (nextBotName(); as bn) {
                    <div class="text-[10px] text-green-300 tracking-wider">
                      Próximo bot: <span class="text-cyan-300">{{ bn }}</span>
                    </div>
                  }

                  @if (!pendingRoll()) {
                    <button type="button" (click)="rollColorDice()"
                      class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                             bg-green-500/10 border border-green-500/30 text-green-400
                             hover:bg-green-500/20 cursor-pointer">
                      Tirar Dado de Colores
                    </button>
                  } @else {
                    <div class="border border-green-500/20 p-3 space-y-2">
                      <div class="flex items-center gap-2 text-[10px] tracking-wider text-green-500/60">
                        Salió:
                        <span class="w-4 h-4 inline-block border border-green-500/30"
                              [style.background]="colorHex(pendingRoll()!)"></span>
                        <span class="text-green-300 uppercase">{{ pendingRoll() }}</span>
                      </div>
                      @if (selectableHexes()!.size > 0) {
                        <div class="text-[9px] tracking-wider text-green-500/50">
                          Click en un hex resaltado para desplegar.
                          Perímetro de seguridad: ≥ {{ DEPLOY_PERIMETER }} hexes a bots enemigos.
                        </div>
                      } @else {
                        <div class="text-[9px] tracking-wider text-yellow-400/70">
                          Sin hexes válidos para este color. Re-tirar.
                        </div>
                      }
                      <button type="button" (click)="rerollColorDice()"
                        class="w-full px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                               border border-green-500/20 text-green-500/60
                               hover:text-green-400 cursor-pointer">
                        Re-tirar
                      </button>
                    </div>
                  }

                  @if (saveError()) {
                    <div class="text-[9px] text-red-400/80 tracking-wider">> {{ saveError() }}</div>
                  }
                </div>
              } @else {
                <div class="space-y-3">
                  <div class="text-[10px] text-green-300 tracking-wider">
                    ✓ Despliegue completado.
                  </div>
                  <div class="text-[9px] text-yellow-400/70 tracking-wider">
                    Fase INIT (PPT + orden de activación) pendiente de integrar.
                  </div>
                </div>
              }
            } @else {
              <div class="text-[9px] tracking-wider text-yellow-400/70">
                Fase {{ currentState().phase }} pendiente de integrar con el BattleEngine.
              </div>
            }

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

  readonly DEPLOY_PERIMETER = DEPLOY_PERIMETER;

  report = signal<BattleReport | null>(null);
  events = signal<BattleEvent[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  finishing = signal(false);
  saveError = signal<string | null>(null);

  deployStarter = signal<PlayerId | null>(null);
  pendingRoll = signal<DotColor | null>(null);

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
    return replayTo(r.initialSnapshot, this.events(), this.events().length);
  });

  readonly deployedBots = computed(() =>
    this.currentState().bots.filter(b => b.q !== -999),
  );

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

  readonly activeDeployer = computed<PlayerId | null>(() => {
    const s = this.currentState();
    if (s.phase !== 'deploy') return null;
    const starter = this.deployStarter();
    if (!starter) return null;
    const other: PlayerId = starter === 1 ? 2 : 1;
    const placed = s.bots.filter(b => b.q !== -999).length;
    const remStarter = this.remainingFor(starter);
    const remOther = this.remainingFor(other);
    if (remStarter + remOther === 0) return null;
    const nextInAlt: PlayerId = placed % 2 === 0 ? starter : other;
    if (nextInAlt === starter && remStarter > 0) return starter;
    if (nextInAlt === other && remOther > 0) return other;
    return remStarter > 0 ? starter : other;
  });

  readonly nextBotName = computed<string | null>(() => {
    const p = this.activeDeployer();
    if (!p) return null;
    const bot = this.currentState().bots.find(b => b.playerId === p && b.q === -999);
    return bot?.name ?? null;
  });

  readonly selectableHexes = computed<Set<string> | null>(() => {
    const color = this.pendingRoll();
    if (!color) return null;
    const deployer = this.activeDeployer();
    if (!deployer) return new Set();
    return this.computeValidDeployHexes(color, deployer);
  });

  readonly highlightedHexes = computed<Set<string> | null>(() => this.selectableHexes());
  readonly highlightColor = computed<string>(() => {
    const c = this.pendingRoll();
    return c ? COLOR_HEX[c] : '#3b82f6';
  });

  readonly canPickHex = computed(() => {
    const s = this.selectableHexes();
    return !!s && s.size > 0;
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
        const r = (await resp.json()) as BattleReport;
        this.report.set(r);
        this.events.set(r.events ?? []);
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.loading.set(false);
  }

  aliasFor(p: PlayerId): string {
    return this.report()?.[p === 1 ? 'player1Alias' : 'player2Alias'] ?? `P${p}`;
  }

  totalFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p).length;
  }

  remainingFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p && b.q === -999).length;
  }

  colorHex(c: DotColor): string { return COLOR_HEX[c]; }

  rollColorDice(): void {
    this.pendingRoll.set(rollDadoColores());
  }

  rerollColorDice(): void {
    this.rollColorDice();
  }

  async onHexClick(coord: { q: number; r: number }): Promise<void> {
    const color = this.pendingRoll();
    const deployer = this.activeDeployer();
    if (!color || !deployer) return;
    const valid = this.selectableHexes();
    if (!valid?.has(hexKey(coord.q, coord.r))) return;
    const bot = this.currentState().bots.find(b => b.playerId === deployer && b.q === -999);
    if (!bot) return;

    const ev: BattleEvent = {
      turn: 0,
      activation: 0,
      phase: 'deploy',
      timestamp: new Date().toISOString(),
      botId: bot.id,
      kind: 'deployed',
      payload: { q: coord.q, r: coord.r, color },
    };
    await this.appendEvents([ev]);
    this.pendingRoll.set(null);
  }

  private async appendEvents(newEvs: BattleEvent[]): Promise<void> {
    const r = this.report();
    if (!r) return;
    this.saveError.set(null);
    const prev = this.events();
    this.events.set([...prev, ...newEvs]);
    try {
      const resp = await fetch(`${API_URL}/api/battles/${r.id}/events`, {
        method: 'PATCH',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ events: newEvs }),
      });
      if (!resp.ok) {
        this.events.set(prev);
        this.saveError.set(`No se pudo guardar (${resp.status}). Reintenta.`);
      }
    } catch (e) {
      this.events.set(prev);
      this.saveError.set(String(e));
    }
  }

  private computeValidDeployHexes(color: DotColor, deployer: PlayerId): Set<string> {
    const s = this.currentState();
    const enemies: BattleBot[] = s.bots.filter(
      b => b.playerId !== deployer && b.q !== -999 && !b.destroyed,
    );
    const occupied = new Set(
      s.bots.filter(b => b.q !== -999).map(b => hexKey(b.q, b.r)),
    );
    const typeMap = new Map(s.hexMap.hexTypes.map(t => [t.id, t]));
    const out = new Set<string>();
    for (const h of s.hexMap.hexes) {
      if (h.dot !== color) continue;
      const type = typeMap.get(h.typeId);
      if (type?.properties?.['traversable'] === 'false') continue;
      const k = hexKey(h.q, h.r);
      if (occupied.has(k)) continue;
      let ok = true;
      for (const e of enemies) {
        if (hexDistance(h.q, h.r, e.q, e.r) < DEPLOY_PERIMETER) { ok = false; break; }
      }
      if (ok) out.add(k);
    }
    return out;
  }

  async finish(): Promise<void> {
    const r = this.report();
    if (!r) return;
    this.finishing.set(true);
    try {
      await fetch(`${API_URL}/api/battles/${r.id}/finish`, {
        method: 'PATCH',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ winner: null, finalState: this.currentState() }),
      });
      this.router.navigate(['/admin/simulator']);
    } catch (e) {
      this.error.set(String(e));
    }
    this.finishing.set(false);
  }
}
