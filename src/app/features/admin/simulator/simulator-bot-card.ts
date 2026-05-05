import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { BattleBot, FunctionCall, StatusEffectKind } from '../../../shared/types/battle.types';
import { DataService } from '../../../core/services/data';
import { classifyCode } from '../../../shared/markdown/marked-extensions';

export interface FunctionEntry {
  id: string;
  func_name: string;
  func_type: string;
  version: string;
  range: string;
  damage: string;
  energy: string;
  cost: string;
  effects: string;
}

const RANGE_TYPES: Record<string, { name: string; description: string }> = {
  LR: {
    name: 'Línea recta',
    description: 'El ataque se propaga directo desde el atacante. Si un obstáculo o un Bot ocupa la trayectoria, la línea de visión se interrumpe.',
  },
  SLDV: {
    name: 'Sin línea de visión',
    description: 'Ignora la línea de visión. El objetivo debe seguir dentro del rango de distancia.',
  },
  'R(n)': {
    name: 'Rango (área)',
    description: 'n determina el número de casillas afectadas desde el punto de impacto. Afecta a todos los Bots a esa distancia.',
  },
};

function rangeInfo(range: string): { abbr: string; name: string; description: string }[] {
  const out: { abbr: string; name: string; description: string }[] = [];
  if (/\(LR\)/.test(range)) out.push({ abbr: 'LR', ...RANGE_TYPES['LR'] });
  if (/\(SLDV\)/.test(range)) out.push({ abbr: 'SLDV', ...RANGE_TYPES['SLDV'] });
  if (/\(R\(\d+\)\)/.test(range)) out.push({ abbr: 'R(n)', ...RANGE_TYPES['R(n)'] });
  return out;
}

@Component({
  selector: 'app-simulator-bot-card',
  template: `
    <div class="border bg-black/60"
         [class.border-cyan-400\\/50]="active() && playerId() === 1"
         [class.border-fuchsia-400\\/50]="active() && playerId() === 2"
         [class.border-green-500\\/15]="!active()">

      <div class="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <button type="button" (click)="prev.emit()" [disabled]="totalBots() <= 1"
          class="w-6 h-6 flex items-center justify-center text-[12px]
                 border border-green-500/20 text-green-400/60
                 hover:text-green-300 hover:border-green-500/40
                 disabled:opacity-30 cursor-pointer">◀</button>
        <div class="flex-1 text-center">
          <div class="text-[10px] tracking-[0.25em] uppercase font-bold"
               [class.text-cyan-300]="playerId() === 1"
               [class.text-fuchsia-300]="playerId() === 2"
               style="font-family: 'Orbitron', monospace;">
            {{ bot().name }}
          </div>
          <div class="text-[8px] tracking-wider text-green-500/50">
            UNIT {{ index() + 1 }} / {{ totalBots() }} · V{{ bot().version }}
            @if (bot().destroyed) { · <span class="text-red-400">DESTRUIDO</span> }
          </div>
          @if (!bot().destroyed && (activatedThisTurn() || canIntercept() || (bot().statusEffects?.length ?? 0) > 0)) {
            <div class="flex justify-center gap-1 mt-1 flex-wrap">
              @for (se of (bot().statusEffects ?? []); track se.kind) {
                <span class="relative text-[7px] tracking-[0.15em] uppercase px-1.5 py-0.5 pt-1.5 border cursor-help"
                      [class.border-red-500\\/40]="se.kind === 'REBOOTING'"
                      [class.text-red-300]="se.kind === 'REBOOTING'"
                      [class.bg-red-500\\/10]="se.kind === 'REBOOTING'"
                      [class.border-orange-500\\/40]="se.kind === 'LAG'"
                      [class.text-orange-300]="se.kind === 'LAG'"
                      [class.bg-orange-500\\/10]="se.kind === 'LAG'"
                      [class.border-blue-500\\/40]="se.kind === 'SAFE_MODE'"
                      [class.text-blue-300]="se.kind === 'SAFE_MODE'"
                      [class.bg-blue-500\\/10]="se.kind === 'SAFE_MODE'"
                      [class.border-violet-500\\/40]="se.kind === 'DMZ'"
                      [class.text-violet-300]="se.kind === 'DMZ'"
                      [class.bg-violet-500\\/10]="se.kind === 'DMZ'"
                      (mouseenter)="hoveredStatusKind.set(se.kind)"
                      (mouseleave)="hoveredStatusKind.set(null)"
                      style="line-height:1;">{{ statusLabel(se.kind) }}
                  @if (hoveredStatusKind() === se.kind) {
                    <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50
                                 block w-48 normal-case tracking-normal font-normal
                                 bg-[#060e12]/95 border border-orange-500/25 rounded-sm p-2
                                 shadow-xl shadow-black/50 pointer-events-none"
                          style="line-height:1.4">
                      <span class="block text-[7px] tracking-wider text-red-400/60 mb-0.5 uppercase">{{ statusLabel(se.kind) }}</span>
                      <span class="block text-[9px] text-green-400/55 leading-relaxed"
                            [innerHTML]="statusDescriptionHtml(se.kind)"></span>
                    </span>
                  }
                </span>
              }
              @if (activatedThisTurn()) {
                <span class="text-[7px] tracking-[0.15em] uppercase px-1.5 py-0.5 pt-1.5
                             border border-green-500/35 text-green-400/80 bg-green-500/5"
                      style="line-height:1;">ACTIVADO</span>
              }
              @if (canIntercept()) {
                <span class="text-[7px] tracking-[0.15em] uppercase px-1.5 py-0.5 pt-1.5
                             border border-yellow-500/40 text-yellow-300/85 bg-yellow-500/5"
                      style="line-height:1;">INTERCEPTAR</span>
              }
            </div>
          }
        </div>
        <button type="button" (click)="next.emit()" [disabled]="totalBots() <= 1"
          class="w-6 h-6 flex items-center justify-center text-[12px]
                 border border-green-500/20 text-green-400/60
                 hover:text-green-300 hover:border-green-500/40
                 disabled:opacity-30 cursor-pointer">▶</button>
      </div>

      <div class="p-3 space-y-3 text-[10px]" [class.opacity-40]="bot().destroyed">

        <!-- Variables -->
        <div>
          <div class="text-[8px] tracking-[0.25em] uppercase text-green-500/50 mb-1.5">VARIABLES</div>
          <div class="grid grid-cols-2 gap-1.5">
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between items-baseline">
              <span class="text-[8px] tracking-[0.25em] text-green-500/55 uppercase">LIFE</span>
              <span class="font-bold"
                    [class.text-green-300]="bot().life === bot().maxLife"
                    [class.text-yellow-300]="bot().life < bot().maxLife && bot().life > bot().maxLife / 2"
                    [class.text-red-400]="bot().life <= bot().maxLife / 2 && bot().life > 0">
                {{ bot().life }}<span class="text-green-500/40">/{{ bot().maxLife }}</span>
              </span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between items-baseline">
              <span class="text-[8px] tracking-[0.25em] text-green-500/55 uppercase">ENERGY</span>
              <span class="text-cyan-300 font-bold">{{ bot().energy }}<span class="text-green-500/40">/{{ bot().maxEnergy }}</span></span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between items-baseline">
              <span class="text-[8px] tracking-[0.25em] text-green-500/55 uppercase">SHIELD</span>
              <span class="font-bold text-green-300">{{ bot().shield }}<span class="text-green-500/40">/{{ bot().maxShield }}</span></span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between items-baseline">
              <span class="text-[8px] tracking-[0.25em] text-green-500/55 uppercase">MOVEMENT</span>
              <span class="font-bold text-green-300">{{ bot().maxMovement }}</span>
            </div>
          </div>
          @if (bot().bugs > 0) {
            <div class="mt-1.5 border border-red-500/30 bg-red-500/5 px-2 py-1 flex justify-between items-center text-[10px]">
              <span class="text-[8px] tracking-[0.25em] text-red-400/70 uppercase">BUGS</span>
              <span class="text-red-300 font-bold">{{ bot().bugs }}</span>
            </div>
          }
        </div>

        <!-- Numbers / RAM -->
        <div>
          <div class="text-[8px] tracking-[0.25em] uppercase text-green-500/50 mb-1.5">
            NUMBERS · RAM ({{ bot().numbers.length }}/{{ bot().maxNumbers }})
          </div>
          <div class="flex gap-1 flex-wrap">
            @for (slot of ramSlots(); track $index) {
              @if (slot !== null) {
                <div class="w-7 h-7 border border-green-500/40 bg-green-500/10 flex items-center justify-center
                            text-[11px] text-green-300 font-bold">{{ slot }}</div>
              } @else {
                <div class="w-7 h-7 border border-dashed border-green-500/15 flex items-center justify-center
                            text-[8px] text-green-500/30">—</div>
              }
            }
          </div>
        </div>

        <!-- Pending operations -->
        @if (bot().pendingOperations.length > 0) {
          <div>
            <div class="text-[8px] tracking-[0.25em] uppercase text-green-500/50 mb-1.5">
              OPERATIONS (sin compilar)
            </div>
            <div class="flex flex-wrap gap-1">
              @for (op of bot().pendingOperations; track $index) {
                <span class="px-1.5 py-0.5 text-[9px] tracking-wider border border-green-500/30
                             bg-green-500/5 text-green-300">{{ op }}</span>
              }
            </div>
          </div>
        }

        <!-- Compiled program — solo si compiló en el turno actual -->
        @if (compiledThisTurn() && bot().compiledProgram; as prog) {
          <div>
            <div class="text-[8px] tracking-[0.25em] uppercase text-cyan-400/70 mb-1.5">
              PROGRAMA COMPILADO
            </div>
            <ol class="space-y-1">
              @for (op of prog.operations; track $index; let i = $index) {
                <li class="border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[10px] space-y-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-cyan-400/70 w-4 shrink-0">{{ i + 1 }}.</span>
                    <span class="text-cyan-300 tracking-wider w-14 shrink-0">{{ op.kind }}</span>
                    <span class="text-green-300/80 truncate">{{ fnLabel(op.primary) }}</span>
                    @if (op.kind === 'FOR' && op.forCount) {
                      <span class="ml-auto text-[8px] text-green-500/40 shrink-0">×{{ op.forCount }}</span>
                    }
                  </div>
                  @if (op.secondary) {
                    <div class="flex items-center gap-1.5 pl-[22px]">
                      <span class="text-green-500/30 w-14 shrink-0 text-[8px] leading-none">{{ op.kind === 'IF_ELSE' ? 'FALSE:' : 'CATCH:' }}</span>
                      <span class="text-green-300/60 truncate leading-none">{{ fnLabel(op.secondary) }}</span>
                    </div>
                  }
                </li>
              }
            </ol>
          </div>
        }

        <!-- Attacks (collapsible per version) -->
        <div>
          <div class="text-[8px] tracking-[0.25em] uppercase text-green-500/50 mb-1.5">
            ATTACK FUNCTIONS
          </div>
          <div class="space-y-1">
            @for (v of versions; track v) {
              @if (attacksForVersion(v).length > 0) {
                <div class="border transition-all"
                     [class.border-orange-500\\/20]="bot().version >= v && v === 1"
                     [class.border-violet-500\\/20]="bot().version >= v && v === 2"
                     [class.border-cyan-500\\/20]="bot().version >= v && v === 3"
                     [class.border-green-500\\/10]="bot().version < v"
                     [class.opacity-30]="bot().version < v">
                  <button type="button" (click)="versionToggled.emit(v)"
                    class="w-full px-2 py-1 flex items-center justify-between text-[10px]
                           hover:bg-green-500/5 cursor-pointer"
                    [class.bg-orange-500\\/5]="expandedVersion() === v && v === 1"
                    [class.bg-violet-500\\/5]="expandedVersion() === v && v === 2"
                    [class.bg-cyan-500\\/5]="expandedVersion() === v && v === 3">
                    <span class="tracking-wider flex items-center gap-1.5">
                      <span [class.text-orange-300]="bot().version >= v && v === 1"
                            [class.text-violet-300]="bot().version >= v && v === 2"
                            [class.text-cyan-300]="bot().version >= v && v === 3"
                            [class.text-green-500\\/40]="bot().version < v">V{{ v }}</span>
                    </span>
                    <span class="text-[9px]"
                          [class.text-orange-400\\/30]="bot().version === v && v === 1"
                          [class.text-violet-400\\/30]="bot().version === v && v === 2"
                          [class.text-cyan-400\\/30]="bot().version === v && v === 3"
                          [class.text-green-500\\/25]="bot().version !== v">
                      {{ expandedVersion() === v ? '▼' : '▶' }}
                    </span>
                  </button>
                  @if (expandedVersion() === v) {
                    <div class="border-t border-green-500/15 p-2 space-y-2">
                      @for (fn of attacksForVersion(v); track $index) {
                        @if (fn) {
                          <div class="border bg-black/40 p-2"
                               [class.border-orange-500\\/30]="v === 1"
                               [class.border-violet-500\\/30]="v === 2"
                               [class.border-cyan-500\\/30]="v === 3">
                            <div class="font-bold mb-1.5"
                                 [class.text-orange-300]="v === 1"
                                 [class.text-violet-300]="v === 2"
                                 [class.text-cyan-300]="v === 3"
                                 style="font-family: 'Orbitron', monospace;">
                              {{ fn.func_name }}
                            </div>
                            <div class="grid grid-cols-4 gap-1 mb-1.5">
                              <div class="bg-black/50 border border-green-500/10 p-1 text-center">
                                <div class="text-green-500/45 text-[7px] tracking-widest">RANGO</div>
                                <div class="text-[10px] font-bold text-green-300">{{ fn.range || '—' }}</div>
                              </div>
                              <div class="bg-black/50 border border-green-500/10 p-1 text-center">
                                <div class="text-green-500/45 text-[7px] tracking-widest">DAÑO</div>
                                <div class="text-[10px] font-bold text-green-300">{{ fn.damage || '—' }}</div>
                              </div>
                              <div class="bg-black/50 border border-green-500/10 p-1 text-center">
                                <div class="text-green-500/45 text-[7px] tracking-widest">ENERGÍA</div>
                                <div class="text-[10px] font-bold text-green-300">{{ fn.energy || '—' }}</div>
                              </div>
                              <div class="bg-black/50 border border-green-500/10 p-1 text-center">
                                <div class="text-green-500/45 text-[7px] tracking-widest">COSTE</div>
                                <div class="text-[10px] font-bold text-green-300">{{ fn.cost || '—' }}</div>
                              </div>
                            </div>
                            @if (fn.effects) {
                              <div class="text-[7px] tracking-wider text-green-500/50 mb-0.5 uppercase">Efectos</div>
                              <div class="text-[10px] text-green-400/85 leading-relaxed"
                                   [innerHTML]="formatEffects(fn.effects)"></div>
                            }
                            @for (ri of rangeInfoOf(fn.range); track ri.abbr) {
                              <div class="mt-1.5 pt-1.5 border-t border-green-500/10">
                                <div class="text-[8px] tracking-wider text-green-500/50 uppercase">
                                  {{ ri.abbr }} — {{ ri.name }}
                                </div>
                                <div class="text-[9px] text-green-400/55 leading-relaxed"
                                     [innerHTML]="formatEffects(ri.description)"></div>
                              </div>
                            }
                          </div>
                        } @else {
                          <div class="text-[9px] text-green-500/30 italic px-1">slot vacío</div>
                        }
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SimulatorBotCard {
  bot = input.required<BattleBot>();
  index = input<number>(0);
  totalBots = input<number>(1);
  playerId = input<1 | 2>(1);
  active = input<boolean>(false);
  expandedVersion = input<1 | 2 | 3 | null>(null);
  functionsMap = input<Map<string, FunctionEntry>>(new Map());
  activatedThisTurn = input<boolean>(false);
  compiledThisTurn = input<boolean>(false);
  canIntercept = input<boolean>(false);

  private readonly statusEffectDefs = toSignal(inject(DataService).getStatusEffects(), { initialValue: [] });
  private readonly statusDescMap = computed(() => new Map(this.statusEffectDefs().map(s => [s.name, s.description])));

  readonly hoveredStatusKind = signal<StatusEffectKind | null>(null);
  readonly versions: (1 | 2 | 3)[] = [1, 2, 3];

  prev = output<void>();
  next = output<void>();
  versionToggled = output<1 | 2 | 3>();

  readonly ramSlots = computed<(number | null)[]>(() => {
    const b = this.bot();
    const out: (number | null)[] = [];
    for (let i = 0; i < b.maxNumbers; i++) out.push(b.numbers[i] ?? null);
    return out;
  });

  fnLabel(fn: FunctionCall): string {
    if (fn.type === 'move') return `move(${fn.moveDistance})`;
    if (fn.type === 'shield') return 'shield()';
    const entry = this.functionsMap().get(fn.attackFunctionId ?? '');
    const cb = entry?.func_name ?? fn.attackFunctionId ?? '?';
    return `attack(${cb}())`;
  }

  attacksForVersion(v: 1 | 2 | 3): (FunctionEntry | null)[] {
    const b = this.bot();
    const map = this.functionsMap();
    if (v === 1) return b.attacks.v1.map(a => (a ? map.get(a.functionId) ?? null : null));
    if (v === 2) return b.attacks.v2.map(a => (a ? map.get(a.functionId) ?? null : null));
    return b.attacks.v3 ? [map.get(b.attacks.v3.functionId) ?? null] : [];
  }

  rangeInfoOf(range: string): { abbr: string; name: string; description: string }[] {
    return rangeInfo(range);
  }

  statusLabel(kind: StatusEffectKind): string {
    const labels: Record<StatusEffectKind, string> = {
      REBOOTING: 'REBOOT', LAG: 'LAG', SAFE_MODE: 'SAFE MODE', DMZ: 'DMZ',
    };
    return labels[kind] ?? kind;
  }

  formatEffects(text: string): string {
    if (!text) return '';
    return text.replace(/`([^`]+)`/g, (_, code: string) => {
      const cls = classifyCode(code);
      return cls ? `<code class="${cls}">${code}</code>` : `<code>${code}</code>`;
    });
  }

  statusDescriptionHtml(kind: StatusEffectKind): string {
    return this.formatEffects(this.statusDescMap().get(kind) ?? '');
  }

}
