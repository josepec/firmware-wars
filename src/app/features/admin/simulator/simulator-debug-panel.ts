import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { BattleBot, StatusEffectKind, TempBuffKind } from '../../../shared/types/battle.types';
import type { OperationFace } from './engine/dice';
import type { FunctionEntry } from './simulator-bot-card';

type DebugSection = 'dice' | 'bot' | 'rewind' | null;

const STATUS_KINDS: StatusEffectKind[] = ['LAG', 'SAFE_MODE', 'DMZ', 'REBOOTING'];
const BUFF_KINDS: TempBuffKind[] = ['DAMAGE_PLUS_1', 'DAMAGE_DOUBLE'];
const OP_FACES: OperationFace[] = ['<', '<=', '==', '!=', '>=', '>'];

@Component({
  selector: 'app-simulator-debug-panel',
  imports: [FormsModule],
  template: `
    <div class="border bg-black/60 mt-3"
         [class.border-orange-500\\/50]="debugMode()"
         [class.border-green-500\\/15]="!debugMode()">

      <!-- Header -->
      <div class="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-[10px] tracking-[0.25em] uppercase font-bold"
                [class.text-orange-300]="debugMode()"
                [class.text-green-500\\/60]="!debugMode()">
            ⚙ DEBUG
          </span>
          @if (debugMode()) {
            <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                         border border-orange-400/60 bg-orange-500/15 text-orange-300">
              ACTIVO
            </span>
          }
        </div>
        <div class="flex items-center gap-2">
          @if (!debugMode()) {
            <button type="button" (click)="enable.emit()"
              class="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                     bg-orange-500/10 border border-orange-500/40 text-orange-300
                     hover:bg-orange-500/20 cursor-pointer">
              Habilitar modo debug
            </button>
          }
          <button type="button" (click)="finish.emit()" [disabled]="finishing()"
            class="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                   bg-red-500/10 border border-red-500/30 text-red-400
                   hover:bg-red-500/20 disabled:opacity-40 cursor-pointer">
            @if (finishing()) { CERRANDO... } @else { Cerrar partida }
          </button>
        </div>
      </div>

      @if (debugMode()) {
        <div class="border-t border-orange-500/20 px-3 py-3 space-y-3">

          <!-- Section tabs -->
          <div class="flex gap-1 text-[8px] tracking-[0.2em] uppercase">
            @for (s of sections; track s.key) {
              <button type="button" (click)="toggleSection(s.key)"
                class="px-2 py-1 border cursor-pointer transition-all"
                [class.border-orange-400\\/60]="openSection() === s.key"
                [class.bg-orange-500\\/15]="openSection() === s.key"
                [class.text-orange-200]="openSection() === s.key"
                [class.border-green-500\\/20]="openSection() !== s.key"
                [class.text-green-500\\/60]="openSection() !== s.key"
                [class.hover\\:text-green-400]="openSection() !== s.key">
                {{ s.label }}
              </button>
            }
          </div>

          <!-- Forzar dados -->
          @if (openSection() === 'dice') {
            <div class="border border-orange-500/15 bg-black/40 p-3 space-y-3">
              <div class="text-[8px] tracking-[0.2em] uppercase text-orange-300/70">
                Próxima tirada forzada (se consume al usarla)
              </div>
              <!-- d6 -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[9px] tracking-wider text-green-500/60 w-12">d6</span>
                @for (n of [1,2,3,4,5,6]; track n) {
                  <button type="button" (click)="setRoll.emit({ kind: 'd6', value: n })"
                    class="w-6 h-6 text-[10px] font-bold border cursor-pointer"
                    [class.border-orange-400]="forcedRolls().d6 === n"
                    [class.bg-orange-500\\/20]="forcedRolls().d6 === n"
                    [class.text-orange-200]="forcedRolls().d6 === n"
                    [class.border-green-500\\/25]="forcedRolls().d6 !== n"
                    [class.text-green-400\\/60]="forcedRolls().d6 !== n"
                    [class.hover\\:border-orange-400]="forcedRolls().d6 !== n">
                    {{ n }}
                  </button>
                }
                @if (forcedRolls().d6 !== undefined) {
                  <button type="button" (click)="setRoll.emit({ kind: 'd6', value: null })"
                    class="text-[8px] text-red-400/70 hover:text-red-300 cursor-pointer ml-1">×</button>
                }
              </div>
              <!-- d4 -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[9px] tracking-wider text-green-500/60 w-12">d4</span>
                @for (n of [1,2,3,4]; track n) {
                  <button type="button" (click)="setRoll.emit({ kind: 'd4', value: n })"
                    class="w-6 h-6 text-[10px] font-bold border cursor-pointer"
                    [class.border-orange-400]="forcedRolls().d4 === n"
                    [class.bg-orange-500\\/20]="forcedRolls().d4 === n"
                    [class.text-orange-200]="forcedRolls().d4 === n"
                    [class.border-green-500\\/25]="forcedRolls().d4 !== n"
                    [class.text-green-400\\/60]="forcedRolls().d4 !== n">
                    {{ n }}
                  </button>
                }
                @if (forcedRolls().d4 !== undefined) {
                  <button type="button" (click)="setRoll.emit({ kind: 'd4', value: null })"
                    class="text-[8px] text-red-400/70 hover:text-red-300 cursor-pointer ml-1">×</button>
                }
              </div>
              <!-- opFace -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[9px] tracking-wider text-green-500/60 w-12">OP</span>
                @for (f of opFaces; track f) {
                  <button type="button" (click)="setRoll.emit({ kind: 'opFace', value: f })"
                    class="px-1.5 h-6 text-[10px] font-bold border cursor-pointer font-mono"
                    [class.border-orange-400]="forcedRolls().opFace === f"
                    [class.bg-orange-500\\/20]="forcedRolls().opFace === f"
                    [class.text-orange-200]="forcedRolls().opFace === f"
                    [class.border-green-500\\/25]="forcedRolls().opFace !== f"
                    [class.text-green-400\\/60]="forcedRolls().opFace !== f">
                    {{ f }}
                  </button>
                }
                @if (forcedRolls().opFace !== undefined) {
                  <button type="button" (click)="setRoll.emit({ kind: 'opFace', value: null })"
                    class="text-[8px] text-red-400/70 hover:text-red-300 cursor-pointer ml-1">×</button>
                }
              </div>
              <button type="button" (click)="clearRolls.emit()"
                class="text-[8px] tracking-wider uppercase text-green-500/50 hover:text-green-400 cursor-pointer">
                Limpiar todas
              </button>
            </div>
          }

          <!-- Editar bot -->
          @if (openSection() === 'bot') {
            <div class="border border-orange-500/15 bg-black/40 p-3 space-y-3">
              <!-- Bot selector grouped by player -->
              <div class="flex gap-2">
                @for (pid of [1, 2]; track pid) {
                  <div class="flex flex-wrap items-center gap-1 px-2 py-1.5 border"
                       [class.border-cyan-500\\/25]="pid === 1"
                       [class.border-fuchsia-500\\/25]="pid === 2">
                    <div class="text-[7px] tracking-[0.2em] uppercase mb-0.5"
                         [class.text-cyan-500\\/50]="pid === 1"
                         [class.text-fuchsia-500\\/50]="pid === 2">
                      P{{ pid }}
                    </div>
                    @for (b of bots(); track b.id) {
                      @if (b.playerId === pid) {
                        @let isSelected = selectedBot()?.id === b.id;
                        <button type="button" (click)="selectedBotId.set(b.id)"
                          class="px-2 py-1 text-[8px] tracking-wider border cursor-pointer transition-opacity"
                          [class.border-cyan-400\\/60]="isSelected && b.playerId === 1"
                          [class.bg-cyan-500\\/15]="isSelected && b.playerId === 1"
                          [class.text-cyan-200]="isSelected && b.playerId === 1"
                          [class.border-fuchsia-400\\/60]="isSelected && b.playerId === 2"
                          [class.bg-fuchsia-500\\/15]="isSelected && b.playerId === 2"
                          [class.text-fuchsia-200]="isSelected && b.playerId === 2"
                          [class.border-green-500\\/20]="!isSelected"
                          [class.text-green-500\\/60]="!isSelected"
                          [class.opacity-35]="!isSelected">
                          {{ b.name }}
                          @if (b.destroyed) { <span class="text-red-400/70">☠</span> }
                        </button>
                      }
                    }
                  </div>
                }
              </div>

              @if (selectedBot(); as bot) {
                <div class="space-y-2 text-[9px]">
                  <!-- Numeric stats -->
                  @for (stat of statRows(bot); track stat.key) {
                    <div class="flex items-center gap-2">
                      <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px]">{{ stat.label }}</span>
                      <button type="button" (click)="bumpStat(bot, stat.key, -1)"
                        class="w-6 h-6 text-[12px] border border-green-500/30 text-green-400/70 hover:bg-green-500/10 cursor-pointer">−</button>
                      <span class="w-10 text-center font-mono text-green-300 font-bold">{{ stat.value }}</span>
                      <button type="button" (click)="bumpStat(bot, stat.key, 1)"
                        class="w-6 h-6 text-[12px] border border-green-500/30 text-green-400/70 hover:bg-green-500/10 cursor-pointer">+</button>
                      @if (stat.max !== undefined) {
                        <span class="text-green-500/40 text-[8px]">/ {{ stat.max }}</span>
                      }
                    </div>
                  }

                  <!-- Numbers -->
                  <div class="flex items-start gap-2 pt-1 border-t border-orange-500/10">
                    <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px] mt-1">RAM</span>
                    <div class="flex flex-wrap gap-1 flex-1">
                      @for (n of bot.numbers; track $index; let i = $index) {
                        <span class="px-1.5 h-6 inline-flex items-center gap-1 border border-green-500/25 bg-green-500/5 text-green-300 font-bold text-[10px]">
                          {{ n }}
                          <button type="button" (click)="removeNumber(bot, i)"
                            class="text-red-400/70 hover:text-red-300 cursor-pointer text-[10px]">×</button>
                        </span>
                      }
                      <input type="number" [ngModel]="newNumber()" (ngModelChange)="newNumber.set($event)"
                        min="1" max="6"
                        class="w-12 h-6 px-1 bg-black/60 border border-green-500/25 text-green-300 text-[10px] font-mono" />
                      <button type="button" (click)="addNumber(bot)"
                        class="px-2 h-6 text-[8px] tracking-wider border border-green-500/30 text-green-400/70 hover:bg-green-500/10 cursor-pointer">
                        + add
                      </button>
                    </div>
                  </div>

                  <!-- Version -->
                  <div class="flex items-center gap-2 pt-1 border-t border-orange-500/10">
                    <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px]">VERSIÓN</span>
                    @for (v of [1,2,3]; track v) {
                      <button type="button" (click)="setVersion(bot, v)"
                        class="px-2 h-6 text-[9px] tracking-wider border cursor-pointer font-bold"
                        [class.border-orange-400]="bot.version === v"
                        [class.bg-orange-500\\/15]="bot.version === v"
                        [class.text-orange-200]="bot.version === v"
                        [class.border-green-500\\/25]="bot.version !== v"
                        [class.text-green-500\\/60]="bot.version !== v">
                        V{{ v }}
                      </button>
                    }
                  </div>

                  <!-- Status effects -->
                  <div class="flex items-start gap-2 pt-1 border-t border-orange-500/10">
                    <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px] mt-1">STATUS</span>
                    <div class="flex flex-wrap gap-1 flex-1">
                      @for (s of statusKinds; track s) {
                        <button type="button" (click)="toggleStatus(bot, s)"
                          class="px-1.5 h-6 text-[8px] tracking-wider border cursor-pointer"
                          [class.border-yellow-400\\/60]="hasStatus(bot, s)"
                          [class.bg-yellow-500\\/15]="hasStatus(bot, s)"
                          [class.text-yellow-200]="hasStatus(bot, s)"
                          [class.border-green-500\\/20]="!hasStatus(bot, s)"
                          [class.text-green-500\\/50]="!hasStatus(bot, s)">
                          {{ s }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Buffs -->
                  <div class="flex items-start gap-2 pt-1 border-t border-orange-500/10">
                    <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px] mt-1">BUFFS</span>
                    <div class="flex flex-wrap gap-1 flex-1">
                      @for (b of buffKinds; track b) {
                        <button type="button" (click)="toggleBuff(bot, b)"
                          class="px-1.5 h-6 text-[8px] tracking-wider border cursor-pointer"
                          [class.border-cyan-400\\/60]="hasBuff(bot, b)"
                          [class.bg-cyan-500\\/15]="hasBuff(bot, b)"
                          [class.text-cyan-200]="hasBuff(bot, b)"
                          [class.border-green-500\\/20]="!hasBuff(bot, b)"
                          [class.text-green-500\\/50]="!hasBuff(bot, b)">
                          {{ b }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Destroyed toggle -->
                  <div class="flex items-center gap-2 pt-1 border-t border-orange-500/10">
                    <span class="text-green-500/60 w-16 tracking-wider uppercase text-[8px]">ESTADO</span>
                    <button type="button" (click)="toggleDestroyed(bot)"
                      class="px-2 h-6 text-[9px] tracking-wider border cursor-pointer font-bold"
                      [class.border-red-400\\/60]="bot.destroyed"
                      [class.bg-red-500\\/15]="bot.destroyed"
                      [class.text-red-300]="bot.destroyed"
                      [class.border-green-500\\/30]="!bot.destroyed"
                      [class.text-green-400\\/70]="!bot.destroyed">
                      {{ bot.destroyed ? '☠ DESTRUIDO (clic = revivir)' : 'VIVO (clic = destruir)' }}
                    </button>
                  </div>

                  <!-- Attacks selector -->
                  <div class="space-y-1 pt-1 border-t border-orange-500/10">
                    <div class="text-green-500/60 tracking-wider uppercase text-[8px]">ATAQUES</div>
                    @for (slot of attackSlots(bot); track slot.label) {
                      <div class="flex items-center gap-2">
                        <span class="w-12 text-[8px] tracking-wider text-green-500/50">{{ slot.label }}</span>
                        <select [ngModel]="slot.current ?? ''" (ngModelChange)="setAttack(bot, slot.version, slot.idx, $event || null)"
                          class="flex-1 h-6 bg-black/60 border border-green-500/25 text-green-300 text-[10px] font-mono px-1 cursor-pointer">
                          <option value="">— vacío —</option>
                          @for (fn of attacksByVersion(slot.version); track fn.id) {
                            <option [value]="fn.id">{{ fn.func_name }}</option>
                          }
                        </select>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Rewind -->
          @if (openSection() === 'rewind') {
            <div class="border border-orange-500/15 bg-black/40 p-3 space-y-2">
              <div class="text-[8px] tracking-[0.2em] uppercase text-orange-300/70">
                Eliminar los últimos N eventos del log (irreversible)
              </div>
              <div class="text-[9px] text-green-500/60">
                Total eventos: <span class="text-green-300 font-bold">{{ eventsCount() }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] text-green-500/60">Borrar últimos:</span>
                <input type="number" [ngModel]="rewindN()" (ngModelChange)="rewindN.set($event)"
                  min="1" [max]="eventsCount()"
                  class="w-16 h-7 px-2 bg-black/60 border border-green-500/25 text-green-300 text-[10px] font-mono" />
                <button type="button" (click)="doRewind()"
                  [disabled]="rewindN() < 1 || rewindN() > eventsCount()"
                  class="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase
                         bg-red-500/10 border border-red-500/40 text-red-300
                         hover:bg-red-500/20 disabled:opacity-30 cursor-pointer">
                  ⏪ Rewind
                </button>
              </div>
              <div class="flex gap-1">
                @for (n of [1, 5, 10]; track n) {
                  <button type="button" (click)="rewindN.set(n); doRewind()"
                    [disabled]="n > eventsCount()"
                    class="px-2 py-1 text-[8px] tracking-wider border border-green-500/25
                           text-green-400/70 hover:bg-green-500/10 disabled:opacity-30 cursor-pointer">
                    −{{ n }}
                  </button>
                }
              </div>
            </div>
          }

          <div class="text-[7px] tracking-wider text-green-500/40 italic">
            ⓘ Drag&drop bots en el mapa para moverlos. Los cambios quedan en el log de eventos como debug_override.
          </div>
        </div>
      }
    </div>
  `,
})
export class SimulatorDebugPanel {
  bots = input.required<BattleBot[]>();
  activeBotId = input<string | null>(null);
  debugMode = input.required<boolean>();
  forcedRolls = input.required<{ d6?: number; d4?: number; opFace?: OperationFace }>();
  finishing = input.required<boolean>();
  eventsCount = input.required<number>();
  functionsMap = input<Map<string, FunctionEntry>>(new Map());

  enable = output<void>();
  finish = output<void>();
  setRoll = output<{ kind: 'd6' | 'd4' | 'opFace'; value: number | OperationFace | null }>();
  clearRolls = output<void>();
  override = output<{ target: 'bot' | 'state'; botId?: string; patch: Record<string, unknown> }>();
  rewind = output<number>();

  readonly sections: { key: DebugSection; label: string }[] = [
    { key: 'dice', label: '🎲 Forzar dados' },
    { key: 'bot', label: '🤖 Editar bot' },
    { key: 'rewind', label: '⏪ Rewind' },
  ];
  readonly statusKinds = STATUS_KINDS;
  readonly buffKinds = BUFF_KINDS;
  readonly opFaces = OP_FACES;

  openSection = signal<DebugSection>('bot');
  selectedBotId = signal<string | null>(null);
  newNumber = signal<number>(1);
  rewindN = signal<number>(1);

  selectedBot = computed<BattleBot | null>(() => {
    const id = this.selectedBotId() ?? this.activeBotId();
    if (!id) return this.bots()[0] ?? null;
    return this.bots().find(b => b.id === id) ?? this.bots()[0] ?? null;
  });

  toggleSection(s: DebugSection): void {
    this.openSection.update(cur => cur === s ? null : s);
  }

  statRows(bot: BattleBot): { key: 'life' | 'energy' | 'shield' | 'bugs'; label: string; value: number; max?: number }[] {
    return [
      { key: 'life', label: '♥ Vida', value: bot.life, max: bot.maxLife },
      { key: 'energy', label: '⚡ Energía', value: bot.energy, max: bot.maxEnergy },
      { key: 'shield', label: '🛡 Shield', value: bot.shield, max: bot.maxShield },
      { key: 'bugs', label: '🐛 Bugs', value: bot.bugs },
    ];
  }

  bumpStat(bot: BattleBot, key: 'life' | 'energy' | 'shield' | 'bugs', delta: number): void {
    const current = bot[key];
    const next = current + delta;
    this.override.emit({ target: 'bot', botId: bot.id, patch: { [key]: next } });
  }

  addNumber(bot: BattleBot): void {
    const n = Math.max(1, Math.min(6, this.newNumber()));
    this.override.emit({ target: 'bot', botId: bot.id, patch: { numbers: [...bot.numbers, n] } });
  }

  removeNumber(bot: BattleBot, idx: number): void {
    const next = [...bot.numbers];
    next.splice(idx, 1);
    this.override.emit({ target: 'bot', botId: bot.id, patch: { numbers: next } });
  }

  setVersion(bot: BattleBot, v: number): void {
    if (v !== 1 && v !== 2 && v !== 3) return;
    this.override.emit({ target: 'bot', botId: bot.id, patch: { version: v } });
  }

  hasStatus(bot: BattleBot, s: StatusEffectKind): boolean {
    return (bot.statusEffects ?? []).some(x => x.kind === s);
  }

  toggleStatus(bot: BattleBot, s: StatusEffectKind): void {
    const cur = bot.statusEffects ?? [];
    const next = this.hasStatus(bot, s)
      ? cur.filter(x => x.kind !== s)
      : [...cur, { kind: s, appliedTurn: 0 }];
    this.override.emit({ target: 'bot', botId: bot.id, patch: { statusEffects: next } });
  }

  hasBuff(bot: BattleBot, b: TempBuffKind): boolean {
    return (bot.tempBuffs ?? []).some(x => x.kind === b);
  }

  toggleBuff(bot: BattleBot, b: TempBuffKind): void {
    const cur = bot.tempBuffs ?? [];
    const next = this.hasBuff(bot, b)
      ? cur.filter(x => x.kind !== b)
      : [...cur, { kind: b, appliedTurn: 0 }];
    this.override.emit({ target: 'bot', botId: bot.id, patch: { tempBuffs: next } });
  }

  toggleDestroyed(bot: BattleBot): void {
    this.override.emit({ target: 'bot', botId: bot.id, patch: { destroyed: !bot.destroyed } });
  }

  attackSlots(bot: BattleBot): { label: string; version: 1 | 2 | 3; idx: number; current: string | null }[] {
    const out: { label: string; version: 1 | 2 | 3; idx: number; current: string | null }[] = [];
    bot.attacks.v1.forEach((a, i) => out.push({ label: `V1·${i + 1}`, version: 1, idx: i, current: a?.functionId ?? null }));
    bot.attacks.v2.forEach((a, i) => out.push({ label: `V2·${i + 1}`, version: 2, idx: i, current: a?.functionId ?? null }));
    out.push({ label: 'V3', version: 3, idx: 0, current: bot.attacks.v3?.functionId ?? null });
    return out;
  }

  attacksByVersion(v: 1 | 2 | 3): FunctionEntry[] {
    const all = Array.from(this.functionsMap().values());
    return all.filter(f => parseInt(f.version, 10) === v);
  }

  setAttack(bot: BattleBot, version: 1 | 2 | 3, idx: number, fnId: string | null): void {
    const next = {
      v1: bot.attacks.v1.map(x => x ? { ...x } : null),
      v2: bot.attacks.v2.map(x => x ? { ...x } : null),
      v3: bot.attacks.v3 ? { ...bot.attacks.v3 } : null,
    };
    const ref = fnId ? { functionId: fnId } : null;
    if (version === 1) next.v1[idx] = ref;
    else if (version === 2) next.v2[idx] = ref;
    else next.v3 = ref;
    this.override.emit({ target: 'bot', botId: bot.id, patch: { attacks: next } });
  }

  doRewind(): void {
    const n = Math.max(1, Math.min(this.eventsCount(), this.rewindN()));
    this.rewind.emit(n);
    this.rewindN.set(1);
  }
}
