import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-function-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">
            {{ editId() ? 'Editar' : 'Nueva' }} Función
          </h1>
        </div>
        <a routerLink="/admin/functions"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 border border-green-500/15 text-green-500/40
                 hover:text-green-400 hover:border-green-500/30 transition-all">
          Volver
        </a>
      </div>

      @if (loading()) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse py-8">
        > LOADING...
      </div>
      } @else {

      @if (error()) {
      <div class="mb-4 text-[10px] tracking-[0.2em] text-red-400/80 border border-red-500/20 px-4 py-2.5">
        > {{ error() }}
      </div>
      }

      <div class="flex flex-col gap-5">

        <!-- Tipo de función (tabs) -->
        <div class="flex gap-2">
          <button (click)="funcType.set('attack')" type="button"
            class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase border transition-all cursor-pointer"
            [class]="funcType() === 'attack'
              ? 'bg-green-500/20 border-green-400/50 text-green-300'
              : 'border-green-500/15 text-green-500/50 hover:text-green-400'">
            Ataque
          </button>
          <button (click)="funcType.set('passive')" type="button"
            class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase border transition-all cursor-pointer"
            [class]="funcType() === 'passive'
              ? 'bg-green-500/20 border-green-400/50 text-green-300'
              : 'border-green-500/15 text-green-500/50 hover:text-green-400'">
            Pasiva
          </button>
        </div>

        <!-- Función (nombre) -->
        <div class="fn-field">
          <label class="fn-label">Función</label>
          <input type="text" [ngModel]="funcName()" (ngModelChange)="funcName.set($event)"
                 class="fn-input font-mono"
                 [placeholder]="funcType() === 'attack' ? 'powerSmash()' : 'reinforcedChassis()'" />
        </div>

        @if (funcType() === 'attack') {
        <!-- Row: V. / Energía / Coste -->
        <div class="grid grid-cols-3 gap-4">
          <div class="fn-field">
            <label class="fn-label">V. (Versión)</label>
            <input type="text" [ngModel]="version()" (ngModelChange)="version.set($event)"
                   class="fn-input" placeholder="1" />
          </div>
          <div class="fn-field">
            <label class="fn-label">Energía</label>
            <input type="text" [ngModel]="energy()" (ngModelChange)="energy.set($event)"
                   class="fn-input" placeholder="2" />
          </div>
          <div class="fn-field">
            <label class="fn-label">Coste</label>
            <input type="text" [ngModel]="cost()" (ngModelChange)="cost.set($event)"
                   class="fn-input" placeholder="10" />
          </div>
        </div>

        <!-- Row: Rango / Daño -->
        <div class="grid grid-cols-2 gap-4">
          <div class="fn-field">
            <label class="fn-label">Rango</label>
            <input type="text" [ngModel]="range()" (ngModelChange)="range.set($event)"
                   class="fn-input" placeholder="1-2" />
          </div>
          <div class="fn-field">
            <label class="fn-label">Daño</label>
            <input type="text" [ngModel]="damage()" (ngModelChange)="damage.set($event)"
                   class="fn-input" placeholder="1d4" />
          </div>
        </div>
        }

        <!-- Efectos -->
        <div class="fn-field">
          <label class="fn-label">Efectos</label>
          <textarea [ngModel]="effects()" (ngModelChange)="effects.set($event)"
                    class="fn-input resize-y" rows="3"
                    [placeholder]="funcType() === 'attack' ? 'Empuja al objetivo 1 Hex.' : 'El Bot aumenta su shield en +1 de forma permanente.'"></textarea>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-4 border-t border-green-500/10">
          <button (click)="save()" type="button" [disabled]="saving()"
            class="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase
                   bg-green-500/15 border border-green-500/40 text-green-400
                   hover:bg-green-500/25 hover:border-green-400/60 transition-all
                   disabled:opacity-50 cursor-pointer">
            @if (saving()) { GUARDANDO... } @else { Guardar }
          </button>
          <a routerLink="/admin/functions"
            class="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase
                   border border-green-500/15 text-green-500/40
                   hover:text-green-400 transition-all">
            Cancelar
          </a>
        </div>

      </div>
      }

    </div>
  `,
  styles: [`
    .fn-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .fn-label {
      font-size: 9px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgb(34 197 94 / 0.4);
    }
    .fn-input {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      background: rgb(34 197 94 / 0.05);
      border: 1px solid rgb(34 197 94 / 0.2);
      color: rgb(134 239 172);
      letter-spacing: 0.05em;
      &:focus {
        outline: none;
        border-color: rgb(74 222 128 / 0.5);
      }
    }
  `],
})
export class FunctionEditor implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  editId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  funcType = signal<'attack' | 'passive'>('attack');
  funcName = signal('');
  version = signal('');
  range = signal('');
  damage = signal('');
  energy = signal('');
  cost = signal('');
  effects = signal('');

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/functions']);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.loadFunction(id);
    }
  }

  private async loadFunction(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/functions/${id}`);
      if (!resp.ok) throw new Error('Not found');
      const fn = await resp.json();
      this.funcType.set(fn.func_type ?? 'attack');
      this.funcName.set(fn.func_name ?? '');
      this.version.set(fn.version ?? '');
      this.range.set(fn.range ?? '');
      this.damage.set(fn.damage ?? '');
      this.energy.set(fn.energy ?? '');
      this.cost.set(fn.cost ?? '');
      this.effects.set(fn.effects ?? '');
    } catch {
      this.error.set('Error al cargar la función.');
    }
    this.loading.set(false);
  }

  async save(): Promise<void> {
    if (!this.funcName().trim()) {
      this.error.set('El nombre de la función es obligatorio.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      func_name: this.funcName().trim(),
      func_type: this.funcType(),
      version: this.funcType() === 'attack' ? this.version().trim() : '',
      range: this.funcType() === 'attack' ? this.range().trim() : '',
      damage: this.funcType() === 'attack' ? this.damage().trim() : '',
      energy: this.funcType() === 'attack' ? this.energy().trim() : '',
      cost: this.funcType() === 'attack' ? this.cost().trim() : '',
      effects: this.effects().trim(),
    };

    try {
      const id = this.editId();
      const url = id ? `${API_URL}/api/functions/${id}` : `${API_URL}/api/functions`;
      const method = id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Save failed');
      this.router.navigate(['/admin/functions']);
    } catch {
      this.error.set('Error al guardar.');
    }
    this.saving.set(false);
  }
}
