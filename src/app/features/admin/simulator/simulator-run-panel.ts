import { Component, computed, effect, input, output, signal } from '@angular/core';
import type { BattleBot, CompiledOperation, FunctionCall } from '../../../shared/types/battle.types';
import { COMP_LABEL, type RunState } from './simulator-run.utils';
import type { FunctionEntry } from './simulator-bot-card';

@Component({
  selector: 'app-simulator-run-panel',
  template: `
    <div class="pt-2 border-t border-green-500/10 space-y-3">
      <div class="text-[8px] tracking-[0.2em] uppercase text-cyan-400/70">
        RUN · {{ bot().name }} (V{{ bot().version }})
      </div>

      <!-- Program listing -->
      <div class="space-y-1">
        @for (op of program(); track $index; let i = $index) {
          @let isCurrent = i === state().opIdx;
          @let isDone = i < state().opIdx;
          <div class="border px-2 py-1 text-[9px] space-y-0.5"
               [class.border-cyan-500\\/40]="isCurrent"
               [class.bg-cyan-500\\/10]="isCurrent"
               [class.border-green-500\\/15]="!isCurrent"
               [class.opacity-40]="isDone">
            <div class="flex items-center gap-1.5">
              <span class="text-green-500/45 w-4 shrink-0">{{ i + 1 }}.</span>
              <span class="text-cyan-300 tracking-wider w-14 shrink-0">{{ op.kind }}</span>
              <span class="text-green-300/80 truncate">{{ fnLabel(op.primary) }}</span>
              @if (op.kind === 'FOR') {
                <span class="ml-auto text-[8px] shrink-0"
                      [class.text-cyan-400]="isCurrent && state().condResult !== null"
                      [class.text-green-500\/40]="!(isCurrent && state().condResult !== null)">
                  ×{{ isCurrent && state().condResult !== null ? state().condResult : '?' }}
                </span>
              }
            </div>
            @if (op.secondary) {
              <div class="flex items-center gap-1.5 pl-[22px]">
                <span class="text-green-500/30 w-14 shrink-0 text-[8px] leading-none">{{ op.kind === 'IF_ELSE' ? 'FALSE:' : 'CATCH:' }}</span>
                <span class="text-green-300/60 truncate leading-none">{{ fnLabel(op.secondary) }}</span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Current op resolution -->
      @if (state().step === 'idle' && hasCurrentOp()) {
        <div class="space-y-1.5">
          <div class="text-[9px] text-green-500/60">
            Op {{ state().opIdx + 1 }}: {{ currentOp()!.kind }}
          </div>
          <button type="button" (click)="opStarted.emit()"
            class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                   bg-green-500/10 border border-green-500/30 text-green-400
                   hover:bg-green-500/20 cursor-pointer">
            Resolver Op {{ state().opIdx + 1 }}
          </button>
        </div>
      }

      @if (state().step === 'rolling') {
        <div class="flex items-center gap-2 py-2">
          <span class="dice-spin text-2xl">🎲</span>
          <span class="text-green-500/40 italic text-[10px]">tirando...</span>
        </div>
      }

      <!-- Condition readout: d6 [comparator] picked -->
      @if (state().d6 !== null || state().opFace) {
        <div class="border border-green-500/15 bg-black/40 px-3 py-3 space-y-2">
          <div class="flex items-end justify-center gap-3">
            <!-- d6 (left) -->
            <div class="flex flex-col items-center gap-0.5">
              <div class="w-12 h-12 border-2 border-green-500/40 bg-green-500/10
                          flex items-center justify-center text-2xl font-bold text-green-300">
                {{ state().d6 ?? '?' }}
              </div>
              <div class="text-[7px] text-green-500/45 tracking-[0.15em] uppercase">d6</div>
            </div>

            <!-- comparator (middle) — h-12 matches box height; invisible spacer aligns with labels -->
            <div class="flex flex-col items-center gap-0.5">
              <div class="w-12 h-12 flex items-center justify-center text-3xl font-bold leading-none"
                   [class.text-cyan-300]="state().opFace"
                   [class.text-green-500\\/30]="!state().opFace">
                {{ state().opFace ? COMP_LABEL[state().opFace!] : (currentOp()?.kind === 'FOR' ? 'diff' : '?') }}
              </div>
              <div class="text-[7px] opacity-0 select-none tracking-[0.15em]">--</div>
            </div>

            <!-- picked number (right) -->
            <div class="flex flex-col items-center gap-0.5">
              <div class="w-12 h-12 border-2 flex items-center justify-center text-2xl font-bold transition-all"
                   [class.border-cyan-500\\/50]="state().pickedNumber !== null"
                   [class.bg-cyan-500\\/10]="state().pickedNumber !== null"
                   [class.text-cyan-300]="state().pickedNumber !== null"
                   [class.border-yellow-500\\/40]="state().pickedNumber === null && state().step === 'picking-number'"
                   [class.bg-yellow-500\\/5]="state().pickedNumber === null && state().step === 'picking-number'"
                   [class.text-yellow-400\\/80]="state().pickedNumber === null && state().step === 'picking-number'"
                   [class.animate-pulse]="state().pickedNumber === null && state().step === 'picking-number'"
                   [class.border-green-500\\/20]="state().pickedNumber === null && state().step !== 'picking-number'"
                   [class.text-green-500\\/30]="state().pickedNumber === null && state().step !== 'picking-number'">
                {{ state().pickedNumber ?? '?' }}
              </div>
              <div class="text-[7px] text-green-500/45 tracking-[0.15em] uppercase">núm</div>
            </div>
          </div>

          @if (state().condResult !== null) {
            <div class="text-center text-[11px] tracking-[0.25em] uppercase font-bold pt-1 border-t border-green-500/10"
                 [class.text-green-300]="state().condResult"
                 [class.text-red-400]="!state().condResult">
              = {{ typeof state().condResult === 'number' ? state().condResult : (state().condResult ? 'TRUE' : 'FALSE') }}
            </div>
          }
        </div>
      }

      <!-- Number picker -->
      @if (state().step === 'picking-number') {
        <div class="space-y-1">
          <div class="text-[9px] text-yellow-400/80 tracking-wider">Elige un número de tu RAM:</div>
          <div class="flex flex-wrap gap-1">
            @for (n of bot().numbers; track $index) {
              <button type="button" (click)="numberPicked.emit(n)"
                class="w-7 h-7 border border-green-500/40 bg-green-500/10
                       text-green-300 text-[11px] font-bold
                       hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 cursor-pointer">
                {{ n }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Hex / target picker prompt -->
      @if (state().step === 'picking-hex') {
        <div class="text-[9px] text-blue-300/80 tracking-wider animate-pulse">
          Click en un hex resaltado para mover.
        </div>
      }
      @if (state().step === 'picking-target') {
        <div class="text-[9px] text-red-300/80 tracking-wider animate-pulse">
          Click en un enemigo resaltado para atacar.
        </div>
      }

      <!-- Continue / advance -->
      @if (state().step === 'op-done' || state().step === 'evaluated') {
        <button type="button" (click)="nextOp.emit()"
          class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                 bg-cyan-500/10 border border-cyan-500/40 text-cyan-300
                 hover:bg-cyan-500/20 cursor-pointer">
          Continuar
        </button>
      }

      @if (state().step === 'between-iters') {
        <div class="text-[9px] text-cyan-300/80 tracking-wider">
          Iteraciones restantes: {{ state().forRemaining }}
        </div>
      }

      @if (state().step === 'bot-done') {
        <button type="button" (click)="finishRun.emit()"
          class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
                 bg-cyan-500/10 border border-cyan-500/40 text-cyan-300
                 hover:bg-cyan-500/20 cursor-pointer">
          Finalizar turno
        </button>
      }

      <!-- DEBUG phase -->
      @if (state().step === 'debug') {
        <div class="pt-2 border-t border-green-500/10 space-y-2">
          <div class="text-[8px] tracking-[0.2em] uppercase text-yellow-400/70">
            DEBUG · {{ bot().name }}
          </div>
          <div class="text-[8px] text-green-500/50 tracking-wider">
            ⚡ {{ bot().energy }}/{{ bot().maxEnergy }}
            &nbsp;🐛 {{ bot().bugs }}
            &nbsp;RAM [{{ bot().numbers.join(', ') }}]
          </div>

          <!-- debug() -->
          <button type="button"
            [disabled]="bot().bugs === 0 || bot().energy < 2"
            (click)="debugAction.emit({ action: 'debug' })"
            class="w-full px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase
                   bg-yellow-500/10 border border-yellow-500/30 text-yellow-300
                   hover:bg-yellow-500/20 disabled:opacity-30 cursor-pointer">
            debug() — 2⚡ → elimina 1 bug
          </button>

          <!-- patch() -->
          <button type="button"
            [disabled]="bot().bugs === 0 || bot().energy < 5"
            (click)="debugAction.emit({ action: 'patch' })"
            class="w-full px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase
                   bg-yellow-500/10 border border-yellow-500/30 text-yellow-300
                   hover:bg-yellow-500/20 disabled:opacity-30 cursor-pointer">
            patch() — 5⚡ → elimina todos los bugs
          </button>

          <!-- optimize(n) -->
          @if (bot().numbers.length > 0) {
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="text-[8px] text-yellow-400/60 tracking-wider uppercase">optimize(n) — n⚡ → elimina n números de RAM</div>
                @if (optimizeSelected().size > 0) {
                  <div class="text-[8px] text-yellow-300/80">{{ optimizeSelected().size }}⚡</div>
                }
              </div>
              <div class="flex flex-wrap gap-1">
                @for (n of bot().numbers; track $index; let idx = $index) {
                  @let sel = optimizeSelected().has(idx);
                  @let canSelect = sel || optimizeSelected().size < bot().energy;
                  <button type="button"
                    [disabled]="!canSelect"
                    (click)="toggleOptimize(idx)"
                    class="w-7 h-7 text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-30"
                    [class.border-yellow-400]="sel"
                    [class.bg-yellow-500\\/20]="sel"
                    [class.text-yellow-200]="sel"
                    [class.border-yellow-500\\/30]="!sel"
                    [class.bg-yellow-500\\/5]="!sel"
                    [class.text-yellow-400\\/70]="!sel"
                    [class.hover\\:border-yellow-400]="!sel"
                    [class.hover\\:bg-yellow-500\\/15]="!sel">
                    {{ n }}
                  </button>
                }
              </div>
              @if (optimizeSelected().size > 0) {
                <button type="button" (click)="confirmOptimize()"
                  class="w-full px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase
                         bg-yellow-500/10 border border-yellow-500/30 text-yellow-300
                         hover:bg-yellow-500/20 cursor-pointer">
                  Aplicar optimize ({{ optimizeSelected().size }}⚡)
                </button>
              }
            </div>
          }

          <!-- reboot() -->
          <button type="button"
            (click)="debugAction.emit({ action: 'reboot' })"
            class="w-full px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase
                   bg-red-500/10 border border-red-500/30 text-red-300
                   hover:bg-red-500/20 cursor-pointer">
            reboot() — 0⚡ → pierde el próximo turno · reset total
          </button>

          <button type="button" (click)="finishRun.emit()"
            class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase mt-1
                   bg-green-500/10 border border-green-500/30 text-green-400
                   hover:bg-green-500/20 cursor-pointer flex items-center justify-center gap-1">
            <span>Finalizar DEBUG</span><span class="tracking-normal mb-1">→</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class SimulatorRunPanel {
  bot = input.required<BattleBot>();
  state = input.required<RunState>();
  functionsMap = input<Map<string, FunctionEntry>>(new Map());

  opStarted = output<void>();
  numberPicked = output<number>();
  nextOp = output<void>();
  finishRun = output<void>();
  debugAction = output<{ action: string; n?: number }>();

  readonly COMP_LABEL = COMP_LABEL;

  readonly program = computed<CompiledOperation[]>(() =>
    this.bot().compiledProgram?.operations ?? []
  );

  readonly currentOp = computed<CompiledOperation | null>(() => {
    const idx = this.state().opIdx;
    return this.program()[idx] ?? null;
  });

  readonly hasCurrentOp = computed(() => this.currentOp() !== null);

  readonly optimizeSelected = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      void this.bot().id;
      this.optimizeSelected.set(new Set());
    });
  }

  toggleOptimize(idx: number): void {
    this.optimizeSelected.update(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < this.bot().energy) next.add(idx);
      return next;
    });
  }

  confirmOptimize(): void {
    const n = this.optimizeSelected().size;
    if (n === 0) return;
    this.debugAction.emit({ action: 'optimize', n });
    this.optimizeSelected.set(new Set());
  }

  fnLabel(fn: FunctionCall): string {
    if (fn.type === 'move') return `move(${fn.moveDistance})`;
    if (fn.type === 'shield') return 'shield()';
    const entry = this.functionsMap().get(fn.attackFunctionId ?? '');
    const cb = entry?.func_name ?? fn.attackFunctionId ?? '?';
    return `attack(${cb}())`;
  }
}
