import { Component, computed, input, output } from '@angular/core';
import type { BattleBot } from '../../../shared/types/battle.types';

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
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between">
              <span class="text-green-500/60">VIDA</span>
              <span class="font-bold"
                    [class.text-green-300]="bot().life === bot().maxLife"
                    [class.text-yellow-300]="bot().life < bot().maxLife && bot().life > bot().maxLife / 2"
                    [class.text-red-400]="bot().life <= bot().maxLife / 2 && bot().life > 0">
                {{ bot().life }}/{{ bot().maxLife }}
              </span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between">
              <span class="text-green-500/60">⚡ ENERGÍA</span>
              <span class="text-cyan-300 font-bold">{{ bot().energy }}/{{ bot().maxEnergy }}</span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between">
              <span class="text-green-500/60">🛡 ESCUDO</span>
              <span class="font-bold">{{ bot().shield }}/{{ bot().maxShield }}</span>
            </div>
            <div class="border border-green-500/15 bg-black/40 px-2 py-1 flex justify-between">
              <span class="text-green-500/60">MOV</span>
              <span class="font-bold">{{ bot().maxMovement }}</span>
            </div>
          </div>
          @if (bot().bugs > 0) {
            <div class="mt-1.5 border border-red-500/30 bg-red-500/5 px-2 py-1 flex justify-between text-[10px]">
              <span class="text-red-400/70">🐛 BUGS</span>
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
              OPERACIONES (sin compilar)
            </div>
            <div class="flex flex-wrap gap-1">
              @for (op of bot().pendingOperations; track $index) {
                <span class="px-1.5 py-0.5 text-[9px] tracking-wider border border-green-500/30
                             bg-green-500/5 text-green-300">{{ op }}</span>
              }
            </div>
          </div>
        }

        <!-- Compiled program -->
        @if (bot().compiledProgram; as prog) {
          <div>
            <div class="text-[8px] tracking-[0.25em] uppercase text-cyan-400/70 mb-1.5">
              PROGRAMA COMPILADO
            </div>
            <ol class="space-y-1">
              @for (op of prog.operations; track $index; let i = $index) {
                <li class="border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[10px]">
                  <span class="text-cyan-400/70">{{ i + 1 }}.</span>
                  <span class="text-cyan-300 ml-1">{{ op.kind }}</span>
                  <span class="text-green-300/80 ml-1">{{ op.primary.type }}@if (op.primary.moveDistance) {{{'(' + op.primary.moveDistance + ')'}}}</span>
                  @if (op.secondary) {
                    <span class="text-green-500/40">/</span>
                    <span class="text-green-300/80">{{ op.secondary.type }}</span>
                  }
                </li>
              }
            </ol>
          </div>
        }

        <!-- Attacks (collapsible per version) -->
        <div>
          <div class="text-[8px] tracking-[0.25em] uppercase text-green-500/50 mb-1.5">
            FUNCIONES DE ATAQUE
          </div>
          <div class="space-y-1">
            @for (v of versions; track v) {
              @if (attacksForVersion(v).length > 0) {
                <div class="border border-green-500/15">
                  <button type="button" (click)="versionToggled.emit(v)"
                    class="w-full px-2 py-1 flex items-center justify-between text-[10px]
                           hover:bg-green-500/5 cursor-pointer"
                    [class.bg-green-500\\/10]="expandedVersion() === v"
                    [class.text-cyan-300]="bot().version === v">
                    <span class="tracking-wider">
                      V{{ v }}
                      @if (bot().version === v) { <span class="text-[8px] text-cyan-400/70">· activa</span> }
                    </span>
                    <span class="text-[9px] text-green-500/50">
                      {{ expandedVersion() === v ? '▼' : '▶' }}
                    </span>
                  </button>
                  @if (expandedVersion() === v) {
                    <div class="border-t border-green-500/15 p-2 space-y-1.5">
                      @for (fn of attacksForVersion(v); track $index) {
                        @if (fn) {
                          <div class="border border-green-500/10 bg-black/40 p-1.5">
                            <div class="text-[10px] font-bold text-orange-300">{{ fn.func_name }}()</div>
                            <div class="text-[9px] text-green-500/70 mt-0.5 space-x-2">
                              @if (fn.range) { <span>Rango: <span class="text-green-300">{{ fn.range }}</span></span> }
                              @if (fn.damage) { <span>· Daño: <span class="text-red-300">{{ fn.damage }}</span></span> }
                              @if (fn.energy) { <span>· ⚡ <span class="text-cyan-300">{{ fn.energy }}</span></span> }
                            </div>
                            @if (fn.effects) {
                              <div class="text-[9px] text-green-500/55 mt-0.5">{{ fn.effects }}</div>
                            }
                          </div>
                        } @else {
                          <div class="text-[9px] text-green-500/30 italic">slot vacío</div>
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

  attacksForVersion(v: 1 | 2 | 3): (FunctionEntry | null)[] {
    const b = this.bot();
    const map = this.functionsMap();
    if (v === 1) return b.attacks.v1.map(a => (a ? map.get(a.functionId) ?? null : null));
    if (v === 2) return b.attacks.v2.map(a => (a ? map.get(a.functionId) ?? null : null));
    return b.attacks.v3 ? [map.get(b.attacks.v3.functionId) ?? null] : [];
  }
}
