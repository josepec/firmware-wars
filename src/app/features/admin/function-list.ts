import { Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';
import { classifyCode } from '../../shared/markdown/marked-extensions';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface FunctionEntry {
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
  selector: 'app-function-list',
  imports: [RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Funciones</h1>
        </div>
        <a routerLink="/admin/functions/new"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 hover:border-green-400/50 transition-all">
          + Nueva
        </a>
      </div>

      <p class="text-[10px] tracking-[0.2em] text-green-500/35 mb-4">
        > Endpoint JSON: <span class="text-green-400/50">GET /api/functions</span>
      </p>

      @if (loading()) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">
        > LOADING FUNCTIONS...
      </div>
      }

      @if (!loading() && functions().length === 0) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">
        > No hay funciones creadas.
      </div>
      }

      <!-- Funciones de Ataque -->
      @if (attackFns().length > 0) {
      <h2 class="text-[10px] tracking-[0.2em] uppercase text-green-400/60 mb-2">Funciones de Ataque</h2>
      <div class="border border-green-500/15 overflow-x-auto mb-8">
        <table class="w-full border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-green-500/20">
              <th class="fn-th text-left">Función</th>
              <th class="fn-th text-center w-10">V.</th>
              <th class="fn-th text-center">Rango</th>
              <th class="fn-th text-center">Daño</th>
              <th class="fn-th text-center">Energía</th>
              <th class="fn-th text-center">Coste</th>
              <th class="fn-th text-left">Efectos</th>
              <th class="fn-th w-24"></th>
            </tr>
          </thead>
          <tbody>
            @for (f of attackFns(); track f.id) {
            <tr class="border-b border-green-500/8 hover:bg-green-500/3 transition-colors">
              <td class="fn-td font-mono" [style.color]="fnColor(f.func_name)">{{ f.func_name }}</td>
              <td class="fn-td text-center">{{ f.version }}</td>
              <td class="fn-td text-center">{{ f.range }}</td>
              <td class="fn-td text-center">{{ f.damage }}</td>
              <td class="fn-td text-center">{{ f.energy }}</td>
              <td class="fn-td text-center">{{ f.cost }}◈</td>
              <td class="fn-td text-green-500/50 max-w-[200px] truncate" [innerHTML]="renderInline(f.effects)"></td>
              <td class="fn-td">
                <div class="flex items-center gap-1 justify-end">
                  @if (deleteConfirm() === f.id) {
                    <button (click)="deleteFunction(f.id)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             bg-red-500/10 border border-red-500/30 text-red-400
                             hover:bg-red-500/20 transition-all cursor-pointer">Si</button>
                    <button (click)="deleteConfirm.set(null)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-green-500/20 text-green-500/50
                             hover:text-green-400 transition-all cursor-pointer">No</button>
                  } @else {
                    <a [routerLink]="'/admin/functions/' + f.id"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-green-500/20 text-green-500/50
                             hover:text-green-400 hover:border-green-500/40 transition-all">Ed</a>
                    <button (click)="deleteConfirm.set(f.id)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-red-500/15 text-red-500/40
                             hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">X</button>
                  }
                </div>
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      }

      <!-- Funciones Pasivas -->
      @if (passiveFns().length > 0) {
      <h2 class="text-[10px] tracking-[0.2em] uppercase text-green-400/60 mb-2">Funciones Pasivas</h2>
      <div class="border border-green-500/15 overflow-x-auto mb-8">
        <table class="w-full border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-green-500/20">
              <th class="fn-th text-left">Función</th>
              <th class="fn-th text-left">Efectos</th>
              <th class="fn-th w-24"></th>
            </tr>
          </thead>
          <tbody>
            @for (f of passiveFns(); track f.id) {
            <tr class="border-b border-green-500/8 hover:bg-green-500/3 transition-colors">
              <td class="fn-td font-mono" [style.color]="fnColor(f.func_name)">{{ f.func_name }}</td>
              <td class="fn-td text-green-500/50" [innerHTML]="renderInline(f.effects)"></td>
              <td class="fn-td">
                <div class="flex items-center gap-1 justify-end">
                  @if (deleteConfirm() === f.id) {
                    <button (click)="deleteFunction(f.id)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             bg-red-500/10 border border-red-500/30 text-red-400
                             hover:bg-red-500/20 transition-all cursor-pointer">Si</button>
                    <button (click)="deleteConfirm.set(null)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-green-500/20 text-green-500/50
                             hover:text-green-400 transition-all cursor-pointer">No</button>
                  } @else {
                    <a [routerLink]="'/admin/functions/' + f.id"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-green-500/20 text-green-500/50
                             hover:text-green-400 hover:border-green-500/40 transition-all">Ed</a>
                    <button (click)="deleteConfirm.set(f.id)" type="button"
                      class="px-2 py-1 text-[8px] tracking-wider uppercase
                             border border-red-500/15 text-red-500/40
                             hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">X</button>
                  }
                </div>
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      }

      @if (functions().length > 0) {
      <div class="text-[9px] text-green-500/30 tracking-wider">
        {{ attackFns().length }} de ataque · {{ passiveFns().length }} pasivas
      </div>
      }

    </div>
  `,
  styles: [`
    app-function-list .fn-th {
      padding: 0.5rem 0.75rem;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgb(34 197 94 / 0.4);
      white-space: nowrap;
    }
    app-function-list .fn-td {
      padding: 0.4rem 0.75rem;
      color: rgb(34 197 94 / 0.7);
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    app-function-list .fn-td code {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 0.85em;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.07);
      border: 1px solid rgba(0, 255, 136, 0.22);
      padding: 0.1em 0.45em;
      border-radius: 2px;
    }
    app-function-list .fn-td code.bs-kw    { color: var(--bs-kw);    background: color-mix(in srgb, var(--bs-kw)    7%, transparent); border-color: color-mix(in srgb, var(--bs-kw)    22%, transparent); }
    app-function-list .fn-td code.bs-fn    { color: var(--bs-fn);    background: color-mix(in srgb, var(--bs-fn)    7%, transparent); border-color: color-mix(in srgb, var(--bs-fn)    22%, transparent); }
    app-function-list .fn-td code.bs-var   { color: var(--bs-var);   background: color-mix(in srgb, var(--bs-var)   7%, transparent); border-color: color-mix(in srgb, var(--bs-var)   22%, transparent); }
    app-function-list .fn-td code.bs-const  { color: var(--bs-const);  background: color-mix(in srgb, var(--bs-const)  7%, transparent); border-color: color-mix(in srgb, var(--bs-const)  22%, transparent); }
    app-function-list .fn-td code.bs-status { color: var(--bs-status); background: color-mix(in srgb, var(--bs-status) 7%, transparent); border-color: color-mix(in srgb, var(--bs-status) 22%, transparent); }
    app-function-list .fn-td code.bs-phase  { color: var(--bs-type);   background: color-mix(in srgb, var(--bs-type)   7%, transparent); border-color: color-mix(in srgb, var(--bs-type)   22%, transparent); }
  `],
})
export class FunctionList implements OnInit {
  private readonly auth = inject(AdminAuth);

  functions = signal<FunctionEntry[]>([]);
  attackFns = computed(() => this.functions().filter(f => (f.func_type ?? 'attack') !== 'passive'));
  passiveFns = computed(() => this.functions().filter(f => f.func_type === 'passive'));
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  private static readonly COLOR_MAP: Record<string, string> = {
    'bs-fn': 'var(--bs-fn)', 'bs-kw': 'var(--bs-kw)', 'bs-var': 'var(--bs-var)',
    'bs-const': 'var(--bs-const)', 'bs-status': 'var(--bs-status)',
    'bs-phase': 'var(--bs-type)', 'bs-bug': 'var(--bs-status)',
  };
  fnColor(name: string): string {
    return FunctionList.COLOR_MAP[classifyCode(name)] || '';
  }
  renderInline(text: string): string {
    const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe(text).replace(/`([^`]+)`/g, (_, code) => {
      const cls = classifyCode(code);
      return `<code${cls ? ` class="${cls}"` : ''}>${code}</code>`;
    });
  }

  ngOnInit() {
    this.loadFunctions();
  }

  async loadFunctions(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/functions/admin`);
      if (resp.ok) this.functions.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  async deleteFunction(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/functions/${id}`, {
        method: 'DELETE',
        headers: this.auth.authHeaders(),
      });
      this.functions.update(list => list.filter(f => f.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
