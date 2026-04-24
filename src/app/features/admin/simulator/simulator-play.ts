import { JsonPipe, NgTemplateOutlet } from '@angular/common';
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
const ANIM_MS = 900;
const ANIM_KEY = 'simulator-dice-anim';

type CriterionChoice = 'junior-1' | 'junior-2' | 'ppt';
type PptHand = 'r' | 'p' | 's';
type DeploySubPhase = 'criterion' | 'ppt-p1' | 'ppt-p2' | 'ppt-result' | 'done';
type InitSubPhase = 'idle' | 'ppt-p1' | 'ppt-p2' | 'ppt-result' | 'done';
type PptContext = 'deploy' | 'init';

const COLOR_HEX: Record<DotColor, string> = Object.fromEntries(
  DOT_COLORS.map(c => [c.id, c.hex]),
) as Record<DotColor, string>;

function rollPptDie(): PptHand {
  const faces: PptHand[] = ['r', 'p', 's'];
  return faces[Math.floor(Math.random() * faces.length)];
}

@Component({
  selector: 'app-simulator-play',
  imports: [RouterLink, HexMap, NgTemplateOutlet, JsonPipe],
  styles: [`
    @keyframes diceSpin {
      0%   { transform: rotate(0deg)   scale(1); }
      25%  { transform: rotate(90deg)  scale(1.1); }
      50%  { transform: rotate(180deg) scale(0.9); }
      75%  { transform: rotate(270deg) scale(1.1); }
      100% { transform: rotate(360deg) scale(1); }
    }
    .dice-spin {
      animation: diceSpin 0.45s linear infinite;
      display: inline-block;
    }
    @keyframes colorCycle {
      0%   { background: #22c55e; }
      20%  { background: #3b82f6; }
      40%  { background: #eab308; }
      60%  { background: #f97316; }
      80%  { background: #ef4444; }
      100% { background: #22c55e; }
    }
    .color-cycle {
      animation: colorCycle 0.4s linear infinite;
    }
  `],
  template: `
    <div class="min-h-screen p-6 md:p-8 max-w-[1400px] mx-auto">

      <div class="mb-6 flex items-center justify-between">
        <a routerLink="/admin/simulator"
          class="text-[10px] tracking-[0.2em] text-green-500/50 hover:text-green-300">
          ← Volver
        </a>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-[10px] tracking-[0.2em] text-green-500/60 cursor-pointer select-none">
            <input type="checkbox" [checked]="animationEnabled()"
                   (change)="toggleAnimation($any($event.target).checked)"
                   class="accent-cyan-400" />
            Animar tiradas
          </label>
          @if (report(); as r) {
            <div class="text-[10px] tracking-[0.2em] text-green-500/50">
              {{ r.player1Alias }} vs {{ r.player2Alias }}
            </div>
          }
        </div>
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
        <div class="text-[10px] tracking-[0.2em] text-green-500/50 mb-4">
          FASE: <span class="text-green-300">{{ currentState().phase }}</span>
          &middot; Ronda <span class="text-green-300">{{ currentState().turn }}</span>
          @if (subPhaseLabel(); as lbl) {
            &middot; <span class="text-cyan-300">{{ lbl }}</span>
          }
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 items-start">

          <div class="transition-all duration-300"
               [class.opacity-100]="panelState(1) !== 'hidden'"
               [class.opacity-30]="panelState(1) === 'waiting'">
            <ng-container *ngTemplateOutlet="panelTpl; context: { $implicit: 1, r: r }"></ng-container>
          </div>

          <div class="space-y-2 lg:order-none">
            @if (turnBanner(); as tb) {
              <div class="border px-4 py-3 text-center transition-all"
                   [class.border-cyan-400\\/60]="tb.player === 1"
                   [class.bg-cyan-500\\/10]="tb.player === 1"
                   [class.border-fuchsia-400\\/60]="tb.player === 2"
                   [class.bg-fuchsia-500\\/10]="tb.player === 2">
                <div class="text-[9px] tracking-[0.3em] uppercase"
                     [class.text-cyan-300\\/70]="tb.player === 1"
                     [class.text-fuchsia-300\\/70]="tb.player === 2">
                  TURNO
                </div>
                <div class="text-base tracking-[0.15em] uppercase font-bold"
                     style="font-family: 'Orbitron', monospace;"
                     [class.text-cyan-300]="tb.player === 1"
                     [class.text-fuchsia-300]="tb.player === 2">
                  P{{ tb.player }} · {{ tb.alias }}
                </div>
                @if (tb.sub) {
                  <div class="text-[10px] tracking-[0.2em] text-green-500/60 mt-1">{{ tb.sub }}</div>
                }
              </div>
            }
            <div class="border border-green-500/15 bg-black/40 p-2">
              <app-hex-map [mapData]="displayMap()" [size]="28"
                           [interactive]="canPickHex()"
                           [selectable]="selectableHexes()"
                           [highlightedHexes]="highlightedHexes()"
                           [highlightColor]="highlightColor()"
                           (hexClicked)="onHexClick($event)" />
            </div>
          </div>

          <div class="transition-all duration-300"
               [class.opacity-100]="panelState(2) !== 'hidden'"
               [class.opacity-30]="panelState(2) === 'waiting'">
            <ng-container *ngTemplateOutlet="panelTpl; context: { $implicit: 2, r: r }"></ng-container>
          </div>
        </div>

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
          @if (deployComplete() && !initStarted()) {
            <button type="button" (click)="startInit()"
              class="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase
                     bg-cyan-500/10 border border-cyan-500/40 text-cyan-300
                     hover:bg-cyan-500/20 cursor-pointer">
              Iniciar INIT
            </button>
          }

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

        <details class="mt-3 border border-green-500/15 bg-black/40">
          <summary class="px-3 py-2 text-[10px] tracking-[0.2em] text-green-500/60 uppercase cursor-pointer
                          hover:text-green-400">
            Log de eventos ({{ events().length }})
          </summary>
          <div class="max-h-64 overflow-y-auto px-3 py-2 space-y-1 text-[9px] tracking-wider font-mono">
            @if (events().length === 0) {
              <div class="text-green-500/30">(sin eventos)</div>
            }
            @for (ev of recentEvents(); track $index) {
              <div class="text-green-500/70">
                <span class="text-green-500/40">[{{ ev.phase }}·r{{ ev.turn }}]</span>
                <span class="text-cyan-400">{{ ev.kind }}</span>
                @if (ev.botId) { <span class="text-green-500/50"> {{ ev.botId }}</span> }
                <span class="text-green-500/40"> · {{ ev.payload | json }}</span>
              </div>
            }
          </div>
        </details>

        @if (currentState().phase === 'init' && activationOrderNames().length > 0) {
          <div class="mt-3 border border-cyan-500/25 bg-cyan-500/5 p-3">
            <div class="text-[10px] tracking-[0.2em] text-cyan-300 uppercase mb-2">
              Orden de activación
            </div>
            <div class="flex flex-wrap gap-2 text-[9px] tracking-wider">
              @for (n of activationOrderNames(); track $index) {
                <span class="px-2 py-1 border border-green-500/20 text-green-300">
                  {{ $index + 1 }}. {{ n }}
                </span>
              }
            </div>
          </div>
        }
      }
    </div>

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

          @else if (subPhase() === 'ppt-p1' || subPhase() === 'ppt-p2') {
            <ng-container *ngTemplateOutlet="pptRollTpl; context: {
              $implicit: p, ctx: 'deploy',
              rolling: rollingPpt() === p, hand: pptFor(p), active: isActive(p)
            }"></ng-container>
          }

          @else if (subPhase() === 'ppt-result') {
            <ng-container *ngTemplateOutlet="pptResultTpl; context: {
              $implicit: p, ctx: 'deploy',
              h1: pptFor(1), h2: pptFor(2), winner: deployPptWinner()
            }"></ng-container>
          }

          @else if (subPhase() === 'done') {
            @if (isActive(p) && activeDeployer() === p) {
              <div class="text-[9px] tracking-wider text-green-500/50">
                Tu turno. Pendientes: <span class="text-green-300">{{ remainingFor(p) }}</span>
              </div>

              @if (nextBot(); as bot) {
                <div class="text-[10px] text-green-300 tracking-wider">
                  Próximo bot:
                  <span class="text-cyan-300">P{{ bot.playerId }}·{{ bot.name }}</span>
                </div>
              }

              @if (!pendingRoll() && !rollingColor()) {
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
                    @if (rollingColor()) {
                      <span class="w-5 h-5 inline-block border border-green-500/30 color-cycle"></span>
                      <span class="text-green-500/40 italic">tirando...</span>
                    } @else {
                      <span class="w-5 h-5 inline-block border border-green-500/30"
                            [style.background]="colorHex(pendingRoll()!)"></span>
                      <span class="text-green-300 uppercase">{{ pendingRoll() }}</span>
                    }
                  </div>
                  @if (!rollingColor()) {
                    @if (selectableHexes()!.size > 0) {
                      <div class="text-[9px] tracking-wider text-green-500/50">
                        Click en un hex resaltado. Perímetro ≥ {{ DEPLOY_PERIMETER }} a enemigos.
                      </div>
                    } @else {
                      <div class="text-[9px] tracking-wider text-yellow-400/70">
                        Colisión lógica: sin hexes válidos con este color.
                      </div>
                      <button type="button" (click)="rerollColorDice()"
                        class="w-full px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                               border border-yellow-500/30 text-yellow-400/80
                               hover:text-yellow-300 cursor-pointer">
                        Re-tirar (por colisión)
                      </button>
                    }
                  }
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

            @if (isActive(p) && deployComplete() && !initStarted()) {
              <div class="text-[9px] text-yellow-400/70 tracking-wider pt-2 border-t border-green-500/10">
                Despliegue completado. Inicia la fase INIT.
              </div>
            }
          }

          @if (initStarted()) {
            @if (initSubPhase() === 'ppt-p1' || initSubPhase() === 'ppt-p2') {
              <ng-container *ngTemplateOutlet="pptRollTpl; context: {
                $implicit: p, ctx: 'init',
                rolling: rollingInitPpt() === p, hand: initPptFor(p), active: isActive(p)
              }"></ng-container>
            } @else if (initSubPhase() === 'ppt-result') {
              <ng-container *ngTemplateOutlet="pptResultTpl; context: {
                $implicit: p, ctx: 'init',
                h1: initPptFor(1), h2: initPptFor(2), winner: initPptWinner()
              }"></ng-container>
            }
          }
        } @else if (currentState().phase === 'init') {
          <div class="text-[9px] tracking-wider text-green-500/60">
            Iniciativa:
            <span [class.text-cyan-300]="currentState().cpuPriority === p"
                  [class.text-green-500\\/40]="currentState().cpuPriority !== p">
              {{ currentState().cpuPriority === p ? 'Ganador PPT' : 'Perdedor PPT' }}
            </span>
          </div>
          <div class="text-[9px] tracking-wider text-yellow-400/70 pt-2 border-t border-green-500/10">
            Fase BOOT pendiente.
          </div>
        } @else {
          <div class="text-[9px] tracking-wider text-yellow-400/70">
            Fase {{ currentState().phase }} pendiente.
          </div>
        }
      </div>
    </ng-template>

    <!-- PPT roll sub-template -->
    <ng-template #pptRollTpl let-p let-ctx="ctx" let-rolling="rolling" let-hand="hand" let-active="active">
      @if (rolling) {
        <div class="text-[9px] tracking-wider text-yellow-400/80">
          {{ ctx === 'init' ? 'INIT · ' : '' }}Dado PPT — tirando...
        </div>
        <div class="flex items-center gap-2 py-2">
          <span class="dice-spin text-3xl">🎲</span>
          <span class="text-green-500/40 italic">[?]</span>
        </div>
      } @else if (active) {
        <div class="text-[9px] tracking-wider text-yellow-400/80">
          {{ ctx === 'init' ? 'INIT · ' : '' }}Dado PPT — tira en secreto.
        </div>
        <button type="button" (click)="ctx === 'init' ? rollInitPpt(p) : rollPpt(p)"
          class="w-full py-3 text-[10px] tracking-[0.2em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 cursor-pointer">
          Tirar Dado PPT
        </button>
      } @else if (hand) {
        <div class="text-[9px] tracking-wider text-green-500/40">✓ Ya tiró (oculto).</div>
      } @else {
        <div class="text-[9px] tracking-wider text-green-500/40 animate-pulse">
          Esperando tirada del rival...
        </div>
      }
    </ng-template>

    <!-- PPT result sub-template (tie or win — always show both hands) -->
    <ng-template #pptResultTpl let-p let-ctx="ctx" let-h1="h1" let-h2="h2" let-winner="winner">
      <div class="text-[9px] tracking-wider text-yellow-400/80">
        {{ ctx === 'init' ? 'INIT · ' : '' }}PPT · Resultado
      </div>
      <div class="text-[10px] tracking-wider">
        Tu tirada:
        <span class="text-cyan-300 uppercase">
          {{ p === 1 ? pptLabel(h1) : pptLabel(h2) }}
          ({{ p === 1 ? pptEmoji(h1) : pptEmoji(h2) }})
        </span>
      </div>
      <div class="text-[10px] tracking-wider text-green-500/50">
        Rival:
        <span class="text-green-300 uppercase">
          {{ p === 1 ? pptLabel(h2) : pptLabel(h1) }}
          ({{ p === 1 ? pptEmoji(h2) : pptEmoji(h1) }})
        </span>
      </div>

      @if (winner === null) {
        <div class="text-[10px] tracking-wider text-yellow-400 border-t border-green-500/10 pt-2">
          ✦ Empate — re-tirar.
        </div>
        @if (p === 1) {
          <button type="button" (click)="ctx === 'init' ? repeatInitPpt() : repeatPpt()"
            class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                   bg-green-500/10 border border-green-500/30 text-green-400
                   hover:bg-green-500/20 cursor-pointer">
            Re-tirar PPT
          </button>
        }
      } @else {
        <div class="text-[10px] tracking-wider border-t border-green-500/10 pt-2"
             [class.text-cyan-300]="winner === p"
             [class.text-green-500\\/50]="winner !== p">
          {{ winner === p ? '★ Ganas el PPT' : '✗ Pierdes el PPT' }}
        </div>
        @if (p === 1) {
          <button type="button" (click)="ctx === 'init' ? confirmInitResult() : confirmDeployResult()"
            class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                   bg-cyan-500/10 border border-cyan-500/40 text-cyan-300
                   hover:bg-cyan-500/20 cursor-pointer">
            Continuar
          </button>
        }
      }
    </ng-template>
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

  animationEnabled = signal(this.loadAnimPref());

  deployStarter = signal<PlayerId | null>(null);
  pendingRoll = signal<DotColor | null>(null);
  rollingColor = signal(false);

  choiceP1 = signal<CriterionChoice | null>(null);
  choiceP2 = signal<CriterionChoice | null>(null);
  pptP1 = signal<PptHand | null>(null);
  pptP2 = signal<PptHand | null>(null);
  rollingPpt = signal<PlayerId | null>(null);

  initStarted = signal(false);
  initPptP1 = signal<PptHand | null>(null);
  initPptP2 = signal<PptHand | null>(null);
  rollingInitPpt = signal<PlayerId | null>(null);

  readonly subPhase = computed<DeploySubPhase>(() => {
    if (this.deployStarter()) return 'done';
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (!c1 || !c2) return 'criterion';
    if (!this.pptP1()) return 'ppt-p1';
    if (!this.pptP2()) return 'ppt-p2';
    return 'ppt-result';
  });

  readonly deployComplete = computed(() => {
    const s = this.currentState();
    return s.phase === 'deploy' && s.bots.length > 0 &&
           this.remainingFor(1) + this.remainingFor(2) === 0;
  });

  readonly initSubPhase = computed<InitSubPhase>(() => {
    if (this.currentState().phase !== 'deploy') return 'done';
    if (!this.initStarted()) return 'idle';
    if (!this.initPptP1()) return 'ppt-p1';
    if (!this.initPptP2()) return 'ppt-p2';
    return 'ppt-result';
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

  readonly nextBot = computed<BattleBot | null>(() => {
    const p = this.activeDeployer();
    if (!p) return null;
    return this.currentState().bots.find(b => b.playerId === p && b.q === -999) ?? null;
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
    if (this.rollingColor()) return false;
    const s = this.selectableHexes();
    return !!s && s.size > 0;
  });

  readonly turnBanner = computed<{ player: PlayerId; alias: string; sub?: string } | null>(() => {
    const r = this.report();
    if (!r) return null;
    const aliasFor = (p: PlayerId) => p === 1 ? r.player1Alias : r.player2Alias;

    if (this.initStarted() && this.currentState().phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return { player: 1, alias: aliasFor(1), sub: 'INIT · Tira Dado PPT' };
      if (isp === 'ppt-p2') return { player: 2, alias: aliasFor(2), sub: 'INIT · Tira Dado PPT' };
      return null;
    }
    if (this.currentState().phase === 'init') return null;

    const sp = this.subPhase();
    if (sp === 'criterion') return null;
    if (sp === 'ppt-p1') return { player: 1, alias: aliasFor(1), sub: 'Tira Dado PPT' };
    if (sp === 'ppt-p2') return { player: 2, alias: aliasFor(2), sub: 'Tira Dado PPT' };
    if (sp === 'ppt-result') return null;

    const d = this.activeDeployer();
    if (!d) return null;
    const bot = this.nextBot();
    const sub = bot ? `Despliega ${bot.name}` : 'Despliegue';
    return { player: d, alias: aliasFor(d), sub };
  });

  readonly recentEvents = computed<BattleEvent[]>(() => {
    const evs = this.events();
    return evs.slice(-10).reverse();
  });

  readonly deployPptWinner = computed<PlayerId | null>(() => {
    const a = this.pptP1();
    const b = this.pptP2();
    if (!a || !b) return null;
    return this.resolvePpt(a, b);
  });

  readonly initPptWinner = computed<PlayerId | null>(() => {
    const a = this.initPptP1();
    const b = this.initPptP2();
    if (!a || !b) return null;
    return this.resolvePpt(a, b);
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
        this.restoreUiState(r.events ?? []);
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.loading.set(false);
  }

  /** Recupera señales de UI volatiles (criterio/PPT) desde el log persistido. */
  private restoreUiState(events: BattleEvent[]): void {
    for (const ev of events) {
      const p = ev.payload ?? {};
      switch (ev.kind) {
        case 'criterion_chosen': {
          const pl = p['player'] as PlayerId;
          const choice = p['choice'] as CriterionChoice;
          if (pl === 1) this.choiceP1.set(choice);
          if (pl === 2) this.choiceP2.set(choice);
          break;
        }
        case 'ppt_rolled': {
          const pl = p['player'] as PlayerId;
          const hand = p['hand'] as PptHand;
          const ctx = p['context'] as PptContext;
          if (ctx === 'deploy') {
            if (pl === 1) this.pptP1.set(hand);
            if (pl === 2) this.pptP2.set(hand);
          } else {
            if (pl === 1) this.initPptP1.set(hand);
            if (pl === 2) this.initPptP2.set(hand);
          }
          break;
        }
        case 'ppt_starter_set': {
          this.deployStarter.set(p['starter'] as PlayerId);
          break;
        }
        case 'init_ppt': {
          this.initStarted.set(false);
          this.initPptP1.set(null);
          this.initPptP2.set(null);
          break;
        }
      }
    }
  }

  totalFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p).length;
  }

  remainingFor(p: PlayerId): number {
    return this.currentState().bots.filter(b => b.playerId === p && b.q === -999).length;
  }

  colorHex(c: DotColor): string { return COLOR_HEX[c]; }

  /* ── Animation pref ─────────────────────────────── */

  private loadAnimPref(): boolean {
    try {
      const v = localStorage.getItem(ANIM_KEY);
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  }

  toggleAnimation(on: boolean): void {
    this.animationEnabled.set(on);
    try { localStorage.setItem(ANIM_KEY, String(on)); } catch { /* ignore */ }
  }

  private async animateDelay(): Promise<void> {
    if (!this.animationEnabled()) return;
    await new Promise<void>(res => setTimeout(res, ANIM_MS));
  }

  /* ── Panel visibility helpers ───────────────────── */

  isActive(p: PlayerId): boolean {
    if (this.initStarted() && this.currentState().phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1;
      if (isp === 'ppt-p2') return p === 2;
      if (isp === 'ppt-result') return true;
      return false;
    }
    if (this.currentState().phase === 'init') return true;
    const sp = this.subPhase();
    if (sp === 'criterion') return !this.choiceFor(p);
    if (sp === 'ppt-p1') return p === 1;
    if (sp === 'ppt-p2') return p === 2;
    if (sp === 'ppt-result') return true;
    if (sp === 'done') return this.activeDeployer() === p;
    return false;
  }

  panelState(p: PlayerId): 'active' | 'waiting' | 'hidden' {
    if (this.initStarted() && this.currentState().phase === 'deploy') {
      const isp = this.initSubPhase();
      if (isp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
      if (isp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
      return 'active';
    }
    if (this.currentState().phase === 'init') return 'active';
    const sp = this.subPhase();
    if (sp === 'criterion') return 'active';
    if (sp === 'ppt-result') return 'active';
    if (sp === 'ppt-p1') return p === 1 ? 'active' : 'waiting';
    if (sp === 'ppt-p2') return p === 2 ? 'active' : 'waiting';
    const deployer = this.activeDeployer();
    if (!deployer) return 'active';
    return deployer === p ? 'active' : 'waiting';
  }

  subPhaseLabel(): string | null {
    if (this.initStarted() && this.currentState().phase === 'deploy') {
      switch (this.initSubPhase()) {
        case 'ppt-p1': return 'INIT · Dado PPT · P1';
        case 'ppt-p2': return 'INIT · Dado PPT · P2';
        case 'ppt-result': return 'INIT · PPT · Resultado';
        default: return 'INIT';
      }
    }
    if (this.currentState().phase === 'init') return 'Iniciativa resuelta';
    switch (this.subPhase()) {
      case 'criterion': return 'Criterio de inicio';
      case 'ppt-p1': return 'Dado PPT · P1';
      case 'ppt-p2': return 'Dado PPT · P2';
      case 'ppt-result': return 'PPT · Resultado';
      case 'done': return this.activeDeployer() ? 'Despliegue' : null;
    }
  }

  choiceFor(p: PlayerId): CriterionChoice | null {
    return (p === 1 ? this.choiceP1 : this.choiceP2)();
  }

  pptFor(p: PlayerId): PptHand | null {
    return (p === 1 ? this.pptP1 : this.pptP2)();
  }

  initPptFor(p: PlayerId): PptHand | null {
    return (p === 1 ? this.initPptP1 : this.initPptP2)();
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

  async onCriterionPick(player: PlayerId, choice: CriterionChoice): Promise<void> {
    (player === 1 ? this.choiceP1 : this.choiceP2).set(choice);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'criterion_chosen',
      payload: { player, choice },
    }]);
    const c1 = this.choiceP1();
    const c2 = this.choiceP2();
    if (c1 && c2 && c1 === c2 && (c1 === 'junior-1' || c1 === 'junior-2')) {
      const starter: PlayerId = c1 === 'junior-1' ? 1 : 2;
      this.deployStarter.set(starter);
      await this.appendEvents([{
        turn: 0, activation: 0, phase: 'deploy',
        timestamp: new Date().toISOString(),
        kind: 'ppt_starter_set',
        payload: { starter, reason: 'junior-agreement' },
      }]);
    }
  }

  /* ── Dado PPT ───────────────────────────────────── */

  pptLabel(h: PptHand | null | undefined): string {
    if (!h) return '—';
    return h === 'r' ? 'Piedra' : h === 'p' ? 'Papel' : 'Tijera';
  }

  pptEmoji(h: PptHand | null | undefined): string {
    if (!h) return '—';
    return h === 'r' ? '✊' : h === 'p' ? '✋' : '✌';
  }

  async rollPpt(player: PlayerId): Promise<void> {
    if (this.pptFor(player)) return;
    this.rollingPpt.set(player);
    await this.animateDelay();
    const hand = rollPptDie();
    this.rollingPpt.set(null);
    (player === 1 ? this.pptP1 : this.pptP2).set(hand);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_rolled',
      payload: { player, hand, context: 'deploy' as PptContext },
    }]);
  }

  repeatPpt(): void {
    this.pptP1.set(null);
    this.pptP2.set(null);
  }

  /** Confirma el resultado del PPT de despliegue y fija starter. */
  async confirmDeployResult(): Promise<void> {
    const w = this.deployPptWinner();
    if (w === null) return;
    this.deployStarter.set(w);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_starter_set',
      payload: { starter: w, reason: 'ppt' },
    }]);
  }

  private resolvePpt(a: PptHand, b: PptHand): PlayerId | null {
    if (a === b) return null;
    const beats: Record<PptHand, PptHand> = { r: 's', s: 'p', p: 'r' };
    return beats[a] === b ? 1 : 2;
  }

  /* ── INIT (PPT iniciativa) ──────────────────────── */

  startInit(): void {
    if (!this.deployComplete()) return;
    this.initStarted.set(true);
  }

  async rollInitPpt(player: PlayerId): Promise<void> {
    if (this.initPptFor(player)) return;
    this.rollingInitPpt.set(player);
    await this.animateDelay();
    const hand = rollPptDie();
    this.rollingInitPpt.set(null);
    (player === 1 ? this.initPptP1 : this.initPptP2).set(hand);
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      kind: 'ppt_rolled',
      payload: { player, hand, context: 'init' as PptContext },
    }]);
  }

  repeatInitPpt(): void {
    this.initPptP1.set(null);
    this.initPptP2.set(null);
  }

  /** Confirma resultado del PPT de INIT y fija cpuPriority + orden. */
  async confirmInitResult(): Promise<void> {
    const w = this.initPptWinner();
    if (w === null) return;
    await this.resolveInit(w);
  }

  private async resolveInit(winner: PlayerId): Promise<void> {
    const bots = this.currentState().bots;
    const wBots = bots.filter(b => b.playerId === winner && !b.destroyed).map(b => b.id);
    const lBots = bots.filter(b => b.playerId !== winner && !b.destroyed).map(b => b.id);
    const order: string[] = [];
    const n = Math.max(wBots.length, lBots.length);
    for (let i = 0; i < n; i++) {
      if (i < wBots.length) order.push(wBots[i]);
      if (i < lBots.length) order.push(lBots[i]);
    }
    await this.appendEvents([{
      turn: 1, activation: 0, phase: 'init',
      timestamp: new Date().toISOString(),
      kind: 'init_ppt',
      payload: { winner, activationOrder: order },
    }]);
    this.initStarted.set(false);
    this.initPptP1.set(null);
    this.initPptP2.set(null);
  }

  activationOrderNames(): string[] {
    const s = this.currentState();
    const byId = new Map(s.bots.map(b => [b.id, b]));
    return s.activationOrder.map(id => {
      const bot = byId.get(id);
      return bot ? `P${bot.playerId}·${bot.name}` : id;
    });
  }

  /* ── Dado de Colores ────────────────────────────── */

  async rollColorDice(): Promise<void> {
    if (this.rollingColor()) return;
    this.rollingColor.set(true);
    this.pendingRoll.set(null);
    await this.animateDelay();
    const color = rollDadoColores();
    this.pendingRoll.set(color);
    this.rollingColor.set(false);
    const deployer = this.activeDeployer();
    const bot = this.nextBot();
    await this.appendEvents([{
      turn: 0, activation: 0, phase: 'deploy',
      timestamp: new Date().toISOString(),
      botId: bot?.id,
      kind: 'color_rolled',
      payload: { player: deployer, color },
    }]);
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
      turn: 0, activation: 0, phase: 'deploy',
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
