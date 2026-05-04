import { Component, computed, effect, input, output, signal } from '@angular/core';
import type { AttackRef, BattleBot, CompiledOperation, CompiledProgram, OperationKind } from '../../../shared/types/battle.types';
import type { FunctionEntry } from './simulator-bot-card';

interface FnOption { value: string; label: string }
interface DraftSlot { op: OperationKind; primary: string | null; secondary: string | null }

function parseFnKey(key: string): CompiledOperation['primary'] {
  if (key === 'shield') return { type: 'shield' };
  if (key.startsWith('move:')) return { type: 'move', moveDistance: parseInt(key.slice(5)) };
  return { type: 'attack', attackFunctionId: key.slice(7) };
}

function funcSig(key: string | null): string {
  if (!key) return '';
  if (key.startsWith('move:')) return 'move';
  if (key === 'shield') return 'shield';
  return 'attack';
}

function hasSecondarySlot(op: OperationKind): boolean {
  return op === 'IF_ELSE' || op === 'TRY_CATCH';
}

@Component({
  selector: 'app-compile-editor',
  template: `
    <div class="pt-2 border-t border-green-500/10 space-y-3">
      <div class="text-[8px] tracking-[0.2em] uppercase text-cyan-400/70">
        COMPILE · {{ bot().name }} (V{{ bot().version }}) · {{ availableSlots() }} slots
      </div>
      @if (hasDMZ()) {
        <div class="text-[8px] text-violet-300/80 border border-violet-500/30 bg-violet-500/10 px-2 py-1 tracking-wider">
          ⚡ DMZ activo — funciones de ataque bloqueadas
        </div>
      }

      <div>
        <div class="text-[8px] text-green-500/45 tracking-wider mb-1">Pool disponible:</div>
        <div class="flex flex-wrap gap-1">
          @for (op of poolDisplay(); track $index) {
            @let blocked = !canAdd() || (isLoop(op) && loopCount() >= 1);
            <button type="button" (click)="addSlot(op)" [disabled]="blocked"
              class="px-2 py-0.5 text-[9px] border border-green-500/20 text-green-400
                     hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer
                     disabled:opacity-25 disabled:cursor-not-allowed">
              {{ op }}
            </button>
          }
          @if (poolDisplay().length === 0 && draftOps().length < bot().maxOperations) {
            <span class="text-[9px] text-green-500/30 italic">sin operaciones disponibles</span>
          }
        </div>
      </div>

      @if (draftOps().length > 0) {
        <div class="space-y-2">
          @for (op of draftOps(); track $index; let i = $index) {
            <div class="border border-cyan-500/20 bg-cyan-500/5 p-2 space-y-1.5">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] text-cyan-300 tracking-wider font-bold">{{ i + 1 }}. {{ op }}</span>
                <button type="button" (click)="removeSlot(i)"
                  class="text-[8px] text-red-400/50 hover:text-red-300 cursor-pointer px-1">✕</button>
              </div>


              <div class="flex items-center gap-1.5">
                <span class="text-[8px] text-green-500/45 w-14 shrink-0">
                  {{ op === 'IF_ELSE' ? 'TRUE:' : op === 'TRY_CATCH' ? 'TRY:' : 'Fn:' }}
                </span>
                <select (change)="setPrimary(i, $any($event.target).value || null)"
                  class="flex-1 min-w-0 bg-black/80 border border-green-500/20 text-[9px]
                         text-green-300 px-1 py-0.5 cursor-pointer">
                  <option value="">-- función --</option>
                  @for (opt of fnOptions(); track opt.value) {
                    <option [value]="opt.value" [selected]="draftPrimary()[i] === opt.value">
                      {{ opt.label }}
                    </option>
                  }
                </select>
              </div>

              @if (hasSecondarySlot(op)) {
                <div class="flex items-center gap-1.5">
                  <span class="text-[8px] text-green-500/45 w-14 shrink-0">
                    {{ op === 'IF_ELSE' ? 'FALSE:' : 'CATCH:' }}
                    <span class="text-green-500/30">(opc)</span>
                  </span>
                  <select (change)="setSecondary(i, $any($event.target).value || null)"
                    class="flex-1 min-w-0 bg-black/80 border border-green-500/20 text-[9px]
                           text-green-300 px-1 py-0.5 cursor-pointer">
                    <option value="">-- función --</option>
                    @for (opt of fnOptions(); track opt.value) {
                      <option [value]="opt.value" [selected]="draftSecondary()[i] === opt.value">
                        {{ opt.label }}
                      </option>
                    }
                  </select>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (validationError(); as err) {
        <div class="text-[8px] text-yellow-400/70 tracking-wider">⚠ {{ err }}</div>
      }

      <button type="button" (click)="commit()" [disabled]="!isValid()"
        class="w-full px-3 py-2 text-[10px] tracking-[0.2em] uppercase
               bg-cyan-500/10 border border-cyan-500/40 text-cyan-300
               hover:bg-cyan-500/20 disabled:opacity-25 cursor-pointer">
        Compilar programa
      </button>
    </div>
  `,
})
export class CompileEditor {
  bot = input.required<BattleBot>();
  functionsMap = input<Map<string, FunctionEntry>>(new Map());
  committed = output<CompiledProgram>();

  draftOps = signal<OperationKind[]>([]);
  draftPrimary = signal<(string | null)[]>([]);
  draftSecondary = signal<(string | null)[]>([]);

  private lastBotId = '';

  constructor() {
    effect(() => {
      const id = this.bot().id;
      if (id !== this.lastBotId) {
        this.lastBotId = id;
        this.draftOps.set([]);
        this.draftPrimary.set([]);
        this.draftSecondary.set([]);
      }
    }, { allowSignalWrites: true });
  }

  readonly poolDisplay = computed<OperationKind[]>(() => {
    const pool = [...this.bot().pendingOperations];
    for (const op of this.draftOps()) {
      const idx = pool.indexOf(op);
      if (idx >= 0) pool.splice(idx, 1);
    }
    return pool;
  });

  readonly availableSlots = computed(() => Math.max(0, this.bot().maxOperations - this.bot().bugs));
  readonly canAdd = computed(() => this.draftOps().length < this.availableSlots());
  readonly loopCount = computed(() => this.draftOps().filter(o => o === 'FOR' || o === 'WHILE').length);

  readonly hasDMZ = computed(() => (this.bot().statusEffects ?? []).some(se => se.kind === 'DMZ'));

  readonly fnOptions = computed<FnOption[]>(() => {
    const bot = this.bot();
    const fmap = this.functionsMap();
    const opts: FnOption[] = [];
    for (let n = 1; n <= bot.maxMovement; n++) opts.push({ value: `move:${n}`, label: `move(${n})` });
    opts.push({ value: 'shield', label: 'shield()' });
    if (!this.hasDMZ()) {
      const addAttacks = (refs: (AttackRef | null)[], vLabel: string) => {
        for (const ref of refs) {
          if (!ref) continue;
          const fn = fmap.get(ref.functionId);
          opts.push({ value: `attack:${ref.functionId}`, label: `${fn?.func_name ?? ref.functionId} [V${vLabel}]` });
        }
      };
      addAttacks(bot.attacks.v1, '1');
      if (bot.version >= 2) addAttacks(bot.attacks.v2, '2');
      if (bot.version >= 3 && bot.attacks.v3) {
        const ref = bot.attacks.v3;
        const fn = fmap.get(ref.functionId);
        opts.push({ value: `attack:${ref.functionId}`, label: `${fn?.func_name ?? ref.functionId} [V3]` });
      }
    }
    return opts;
  });

  readonly isValid = computed<boolean>(() => {
    const ops = this.draftOps();
    if (ops.length === 0) return false;
    const prim = this.draftPrimary();
    const sec = this.draftSecondary();
    for (let i = 0; i < ops.length; i++) {
      if (!prim[i]) return false;
      if (hasSecondarySlot(ops[i]) && sec[i] && funcSig(prim[i]) === funcSig(sec[i])) return false;
    }
    return true;
  });

  readonly validationError = computed<string | null>(() => {
    const ops = this.draftOps();
    if (ops.length === 0) return 'Añade al menos una operación del pool.';
    const prim = this.draftPrimary();
    const sec = this.draftSecondary();
    for (let i = 0; i < ops.length; i++) {
      if (!prim[i]) return `Op ${i + 1}: selecciona función primaria.`;
      if (hasSecondarySlot(ops[i]) && sec[i] && funcSig(prim[i]) === funcSig(sec[i]))
        return `Op ${i + 1}: primaria y secundaria deben ser funciones distintas.`;
    }
    return null;
  });

  isLoop(op: OperationKind): boolean { return op === 'FOR' || op === 'WHILE'; }
  hasSecondarySlot(op: OperationKind): boolean { return hasSecondarySlot(op); }

  addSlot(op: OperationKind): void {
    if (!this.canAdd()) return;
    if (this.isLoop(op) && this.loopCount() >= 1) return;
    this.draftOps.update(a => [...a, op]);
    this.draftPrimary.update(a => [...a, null]);
    this.draftSecondary.update(a => [...a, null]);
  }

  removeSlot(idx: number): void {
    this.draftOps.update(a => a.filter((_, i) => i !== idx));
    this.draftPrimary.update(a => a.filter((_, i) => i !== idx));
    this.draftSecondary.update(a => a.filter((_, i) => i !== idx));
  }

  setPrimary(idx: number, val: string | null): void {
    this.draftPrimary.update(a => a.map((v, i) => i === idx ? val : v));
  }

  setSecondary(idx: number, val: string | null): void {
    this.draftSecondary.update(a => a.map((v, i) => i === idx ? val : v));
  }

  commit(): void {
    if (!this.isValid()) return;
    const ops = this.draftOps();
    const prim = this.draftPrimary();
    const sec = this.draftSecondary();
    const operations: CompiledOperation[] = ops.map((kind, i) => ({
      kind,
      primary: parseFnKey(prim[i]!),
      ...(hasSecondarySlot(kind) && sec[i] ? { secondary: parseFnKey(sec[i]!) } : {}),
    }));
    this.committed.emit({ operations });
  }
}
