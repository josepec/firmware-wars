import { NgTemplateOutlet } from '@angular/common';
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

type CriterionChoice = 'junior-1' | 'junior-2' | 'ppt';
type PptHand = 'r' | 'p' | 's';
type DeploySubPhase = 'criterion' | 'ppt-p1' | 'ppt-p2' | 'ppt-reveal' | 'done';

const COLOR_HEX: Record<DotColor, string> = Object.fromEntries(
  DOT_COLORS.map(c => [c.id, c.hex]),
) as Record<DotColor, string>;

function rollPptDie(): PptHand {
  const faces: PptHand[] = ['r', 'p', 's'];
  return faces[Math.floor(Math.random() * faces.length)];
}

@Component({
  selector: 'app-simulator-play',
  imports: [RouterLink, HexMap, NgTemplateOutlet],
  template: `
    <div class="min-h-screen p-6 md:p-8 max-w-[1400px] mx-auto">

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
        <!-- Header común ─────────────────────────────────── -->
        <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// PARTIDA</div>
        <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase mb-2"
            style="font-family: 'Orbitron', monospace;">{{ r.title }}</h1>
        <div class="text-[10px] tracking-[0.2em] text-green-500/50 mb-4">
          FASE: <span class="text-green-300">{{ currentState().phase }}</span>
          &middot; Ronda <span class="text-green-300">{{ currentState().turn }}</span>
          @if (subPhaseLabel(); as lbl) {
            &middot; <span class="text-cyan-300">{{ lbl }}</span>
          }
        </div>

        <!-- Layout 3 columnas: P1 · Map · P2 ───────────────── -->
        <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 items-start">

          <!-- Panel P1 (izquierda) -->
          <div class="transition-all duration-300"
               [class.opacity-100]="panelState(1) !== 'hidden'"
               [class.opacity-30]="panelState(1) === 'waiting'">
            <ng-container *ngTemplateOutlet="panelTpl; context: { $implicit: 1, r: r }"></ng-container>
          </div>

          <!-- Map -->
          <div class="border border-green-500/15 bg-black/40 p-2 lg:order-none">
            <app-hex-map [mapData]="displayMap()" [size]="28"
                         [interactive]="canPickHex()"
                         [selectable]="selectableHexes()"
                         [highlightedHexes]="highlightedHexes()"
                         [highlightColor]="highlightColor()"
                         (hexClicked)="onHexClick($event)" />
          </div>

          <!-- Panel P2 (derecha) -->
          <div class="transition-all duration-300"
               [class.opacity-100]="panelState(2) !== 'hidden'"
               [class.opacity-30]="panelState(2) === 'waiting'">
            <ng-container *ngTemplateOutlet="panelTpl; context: { $implicit: 2, r: r }"></ng-container>
          </div>
        </div>

        <!-- Resumen general y acciones comunes ──────────────── -->
        <div class="mt-4 border border-green-500/15 p-3 flex flex-wrap items-center gap-4
                    text-[9px] tracking-wider text-green-500/50">
          <span>
            <span class="text-green-500/40">P1 desplegados:</span>
            <span class="text-green-300 ml-1">{{ totalFor(1) - remainingFor(1) }} / {{ totalFor(1) }}</span>
          </span>
          <span class="text-green-500/20">|</span>
          <span>
            <span class="text-green-500/40">P2 desplegados:</span>
            <span class="text-green-300 ml-1">{{ totalFor(2) - remainingFor(2) }} / {{ totalFor(2) }}</span>
          </span>
          @if (saveError()) {
            <span class="text-red-400/80 ml-auto">> {{ saveError() }}</span>
          } @else {
            <span class="ml-auto"></span>
          }
          <button type="button" (click)="finish()" [disabled]="finishing()"
            class="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                   bg-red-500/10 border border-red-500/30 text-red-400
                   hover:bg-red-500/20 transition-all
                   disabled:opacity-40 cursor-pointer">
            @if (finishing()) { CERRANDO... } @else { Cerrar partida }
          </button>
        </div>
      }
    </div>

    <!-- ─────────── Template de panel por jugador ─────────── -->
    <ng-template #panelTpl let-p let-r="r">
      <div class="border p-3 space-y-3 bg-black/40"
           [class.border-cyan-400\\/40]="isActive(p)"
           [class.border-green-500\\/15]="!isActive(p)">
        <div class="text-[10px] tracking-[0.2em] uppercase flex items-center gap-2"
             [class.text-cyan-300]="isActive(p)"
             [class.text-green-500\\/50]="!isActive(p)">
          <span class="inline-block w-2 h-2 rounded-full"
                [class.bg-cyan-400]="isActive(p)"
                [class.bg-green-500\\/30]="!isActive(p)"></span>
          P{{ p }} · {{ p === 1 ? r.player1Alias : r.player2Alias }}
        </div>

        @if (currentState().phase === 'deploy') {
          <!-- Subfase 'criterion' ─────────────────────── -->
          @if (subPhase() === 'criterion') {
            @if (choiceFor(p); as c) {
              <div class="text-[9px] text-cyan-300 tracking-wider">✓ {{ choiceLabel(c, r.player1Alias, r.player2Alias) }}</div>
              <button type="button" (click)="resetChoice(p)"
                class="text-[8px] text-green-500/40 hover:text-green-300 tracking-wider cursor-pointer">
                cambiar
              </button>
            } @else {
              <div class="text-[8px] tracking-wider text-green-500/40">Elige criterio:</div>
              <button type="button" (click)="onCriterionPick(p, 'junior-1')"
                class="w-full text-left px-2 py-1 text-[9px] border border-green-500/15
                       text-green-500/60 hover:border-green-400/50 hover:text-green-400 cursor-pointer">
                {{ r.player1Alias }} es Junior
              </button>
              <button type="button" (click)="onCriterionPick(p, 'junior-2')"
                class="w-full text-left px-2 py-1 text-[9px] border border-green-500/15
                       text-green-500/60 hover:border-green-400/50 hover:text-green-400 cursor-pointer">
                {{ r.player2Alias }} es Junior
              </button>
              <button type="button" (click)="onCriterionPick(p, 'ppt')"
                class="w-full text-left px-2 py-1 text-[9px] border border-green-500/15
                       text-green-500/60 hover:border-green-400/50 hover:text-green-400 cursor-pointer">
                PPT
              </button>
            }
          }

          <!-- Subfase PPT: tirada ─────────────────────── -->
          @else if (subPhase() === 'ppt-p1' || subPhase() === 'ppt-p2') {
            @if (isActive(p)) {
              <div class="text-[9px] tracking-wider text-yellow-400/80">
                Dado PPT — tira en secreto.
              </div>
              <button type="button" (click)="rollPpt(p)"
                class="w-full py-3 text-[10px] tracking-[0.2em] uppercase
                       bg-green-500/10 border border-green-500/30 text-green-400
                       hover:bg-green-500/20 cursor-pointer">
                Tirar Dado PPT
              </button>
            } @else if (pptFor(p)) {
              <div class="text-[9px] tracking-wider text-green-500/40">✓ Ya tiró (oculto).</div>
            } @else {
              <div class="text-[9px] tracking-wider text-green-500/40 animate-pulse">
                Esperando tirada del rival...
              </div>
            }
          }

          <!-- Subfase PPT: reveal (empate) ─────────────── -->
          @else if (subPhase() === 'ppt-reveal') {
            <div class="text-[9px] tracking-wider text-yellow-400/80">
              PPT · Empate
            </div>
            <div class="text-[10px] text-cyan-300 tracking-wider">
              {{ pptLabel(pptFor(p)!) }}
            </div>
            @if (p === 1) {
              <button type="button" (click)="repeatPpt()"
                class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                       bg-green-500/10 border border-green-500/30 text-green-400
                       hover:bg-green-500/20 cursor-pointer">
                Re-tirar PPT
              </button>
            }
          }

          <!-- Subfase 'done': despliegue por turnos ─────── -->
          @else if (subPhase() === 'done') {
            @if (isActive(p) && activeDeployer() === p) {
              <div class="text-[9px] tracking-wider text-green-500/50">
                Tu turno. Pendientes: <span class="text-green-300">{{ remainingFor(p) }}</span>
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
                <div class="border border-green-500/20 p-2 space-y-2">
                  <div class="flex items-center gap-2 text-[10px] tracking-wider text-green-500/60">
                    Salió:
                    <span class="w-4 h-4 inline-block border border-green-500/30"
                          [style.background]="colorHex(pendingRoll()!)"></span>
                    <span class="text-green-300 uppercase">{{ pendingRoll() }}</span>
                  </div>
                  @if (selectableHexes()!.size > 0) {
                    <div class="text-[9px] tracking-wider text-green-500/50">
                      Click en un hex resaltado. Perímetro ≥ {{ DEPLOY_PERIMETER }} a enemigos.
                    </div>
                  } @else {
                    <div class="text-[9px] tracking-wider text-yellow-400/70">
                      Sin hexes válidos. Re-tirar.
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
            } @else if (remainingFor(p) === 0 && totalFor(p) > 0) {
              <div class="text-[9px] tracking-wider text-green-500/40">
                ✓ Todos desplegados.
              </div>
            } @else if (!activeDeployer()) {
              <div class="text-[9px] tracking-wider text-green-500/40">
                ✓ Despliegue completado.
              </div>
            } @else {
              <div class="text-[9px] tracking-wider text-green-500/40 animate-pulse">
                Esperando...
              </div>
              <div class="text-[9px] tracking-wider text-green-500/30">
                Pendientes: {{ remainingFor(p) }} / {{ totalFor(p) }}
              </div>
            }

            @if (isActive(p) && activeDeployer() === null && remainingFor(1) + remainingFor(2) === 0) {
              <div class="text-[9px] text-yellow-400/70 tracking-wider pt-2 border-t border-green-500/10">
                Fase INIT (PPT iniciativa + upgrade rondas 3/5) pendiente.
              </div>
            }
          }
        } @else {
          <div class="text-[9px] tracking-wider text-yellow-400/70">
            Fase {{ currentState().phase }} pendiente.
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class SimulatorPlay implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly DEPLOY_PERIMETER = DEPLOY_PERIMETER;
  readonly pptHands: PptHand[] = ['r', 'p', 's'];

  report = signal<BattleReport | null>(null);
  events = signal<BattleEvent[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  finishing = signal(false);
  saveError = signal<string | null>(null);

  deployStarter = signal<PlayerId | null>(null);
  pendingRoll = signal<DotColor | null>(null);

  choiceP1 = signal<CriterionChoice | null>(null);
  choiceP2 = signal<CriterionChoice | null>(null);
  pptP1 = signal<PptHand | null>(null);
  pptP2 = signal<PptHand | null>(null);

  readonly subPhase = computed<DeploySubPhase>(() => {
    if (this.deployStarter()) return 'done';
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (!c1 || !c2) return 'criterion';
    if (!this.pptP1()) return 'ppt-p1';
    if (!this.pptP2()) return 'ppt-p2';
    return 'ppt-reveal';
  });

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

  totalFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p).length;
  }

  remainingFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p && b.q === -999).length;
  }

  colorHex(c: DotColor): string { return COLOR_HEX[c]; }

  /* ── Panel visibility helpers ───────────────────── */

  isActive(p: PlayerId): boolean {
    const sp = this.subPhase();
    if (sp === 'criterion') return !this.choiceFor(p);
    if (sp === 'ppt-p1') return p === 1;
    if (sp === 'ppt-p2') return p === 2;
    if (sp === 'ppt-reveal') return true;
    if (sp === 'done') return this.activeDeployer() === p;
    return false;
  }

  /** 'active' | 'waiting' | 'hidden' */
  panelState(p: PlayerId): 'active' | 'waiting' | 'hidden' {
    const sp = this.subPhase();
    if (sp === 'criterion') return 'active';
    if (sp === 'ppt-reveal') return 'active';
    if (sp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
    if (sp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
    // done
    const deployer = this.activeDeployer();
    if (!deployer) return 'active';
    return deployer === p ? 'active' : 'waiting';
  }

  subPhaseLabel(): string | null {
    switch (this.subPhase()) {
      case 'criterion': return 'Criterio de inicio';
      case 'ppt-p1': return 'Dado PPT · P1';
      case 'ppt-p2': return 'Dado PPT · P2';
      case 'ppt-reveal': return 'PPT · Revelación';
      case 'done': return this.activeDeployer() ? 'Despliegue' : null;
    }
  }

  choiceFor(p: PlayerId): CriterionChoice | null {
    return (p === 1 ? this.choiceP1 : this.choiceP2)();
  }

  pptFor(p: PlayerId): PptHand | null {
    return (p === 1 ? this.pptP1 : this.pptP2)();
  }

  /* ── Criterio ───────────────────────────────────── */

  choiceLabel(c: CriterionChoice, p1Alias: string, p2Alias: string): string {
    if (c === 'junior-1') return `${p1Alias} es Junior`;
    if (c === 'junior-2') return `${p2Alias} es Junior`;
    return 'PPT';
  }

  resetChoice(player: PlayerId): void {
    (player === 1 ? this.choiceP1 : this.choiceP2).set(null);
  }

  onCriterionPick(player: PlayerId, choice: CriterionChoice): void {
    (player === 1 ? this.choiceP1 : this.choiceP2).set(choice);
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (c1 && c2 && c1 === c2 && (c1 === 'junior-1' || c1 === 'junior-2')) {
      this.deployStarter.set(c1 === 'junior-1' ? 1 : 2);
    }
  }

  /* ── Dado PPT ───────────────────────────────────── */

  pptLabel(h: PptHand): string {
    return h === 'r' ? 'Piedra' : h === 'p' ? 'Papel' : 'Tijera';
  }

  rollPpt(player: PlayerId): void {
    const hand = rollPptDie();
    (player === 1 ? this.pptP1 : this.pptP2).set(hand);
    const a = this.pptP1();
    const b = this.pptP2();
    if (!a || !b) return;
    const winner = this.resolvePpt(a, b);
    if (winner !== null) this.deployStarter.set(winner);
  }

  repeatPpt(): void {
    this.pptP1.set(null);
    this.pptP2.set(null);
  }

  private resolvePpt(a: PptHand, b: PptHand): PlayerId | null {
    if (a === b) return null;
    const beats: Record<PptHand, PptHand> = { r: 's', s: 'p', p: 'r' };
    return beats[a] === b ? 1 : 2;
  }

  /* ── Dado de Colores ────────────────────────────── */

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
