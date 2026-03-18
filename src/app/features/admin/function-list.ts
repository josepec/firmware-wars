import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface FunctionEntry {
  id: string;
  func_name: string;
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
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Funciónes</h1>
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

      @if (functions().length > 0) {
      <div class="border border-green-500/15 overflow-x-auto">
        <table class="w-full border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-green-500/20">
              <th class="fn-th">Función</th>
              <th class="fn-th w-10">V.</th>
              <th class="fn-th">Rango</th>
              <th class="fn-th">Daño</th>
              <th class="fn-th">Energía</th>
              <th class="fn-th">Coste</th>
              <th class="fn-th">Efectos</th>
              <th class="fn-th w-24"></th>
            </tr>
          </thead>
          <tbody>
            @for (f of functions(); track f.id) {
            <tr class="border-b border-green-500/8 hover:bg-green-500/3 transition-colors">
              <td class="fn-td text-green-300 font-mono">{{ f.func_name }}</td>
              <td class="fn-td text-center">{{ f.version }}</td>
              <td class="fn-td">{{ f.range }}</td>
              <td class="fn-td">{{ f.damage }}</td>
              <td class="fn-td text-center">{{ f.energy }}</td>
              <td class="fn-td">{{ f.cost }}</td>
              <td class="fn-td text-green-500/50 max-w-[200px] truncate">{{ f.effects }}</td>
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

      <div class="mt-3 text-[9px] text-green-500/30 tracking-wider">
        {{ functions().length }} funciones
      </div>
      }

    </div>
  `,
  styles: [`
    .fn-th {
      padding: 0.5rem 0.75rem;
      text-align: left;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgb(34 197 94 / 0.4);
      white-space: nowrap;
    }
    .fn-td {
      padding: 0.4rem 0.75rem;
      color: rgb(34 197 94 / 0.7);
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
  `],
})
export class FunctionList implements OnInit {
  private readonly auth = inject(AdminAuth);

  functions = signal<FunctionEntry[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

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
