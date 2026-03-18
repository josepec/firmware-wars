import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ThreatSummary {
  id: string;
  name: string;
  description: string;
  data?: { imageUrl?: string };
  updated_at: string;
}

@Component({
  selector: 'app-threat-list',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Amenazas</h1>
        </div>
        <a routerLink="/admin/threats/new"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 hover:border-green-400/50 transition-all">
          + Nueva
        </a>
      </div>

      @if (loading()) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">
        > LOADING THREATS...
      </div>
      }

      @if (!loading() && threats().length === 0) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">
        > No hay amenazas creadas.
      </div>
      }

      @if (threats().length > 0) {
      <ul class="border border-green-500/15">
        @for (t of threats(); track t.id) {
        <li class="flex items-center justify-between px-5 py-4
                   border-b border-green-500/10 last:border-b-0
                   hover:bg-green-500/3 transition-colors">
          <div class="flex items-center gap-3">
            @if (t.data?.imageUrl; as imgUrl) {
            <div class="w-10 h-10 flex-shrink-0 border border-green-500/15 bg-black/40 flex items-center justify-center overflow-hidden">
              <img [src]="imgUrl" [alt]="t.name" class="max-w-full max-h-full object-contain" />
            </div>
            }
            <div>
              <div class="text-sm text-green-400 tracking-wider">{{ t.name }}</div>
              <div class="text-[9px] text-green-500/35 tracking-wider mt-0.5">
                {{ t.description || 'Sin descripción' }}
                &middot; {{ t.updated_at | date:'dd/MM/yyyy HH:mm' }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (deleteConfirm() === t.id) {
              <span class="text-[9px] text-red-400/70 tracking-wider mr-1">CONFIRMAR?</span>
              <button (click)="deleteThreat(t.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       bg-red-500/10 border border-red-500/30 text-red-400
                       hover:bg-red-500/20 transition-all cursor-pointer">
                Si
              </button>
              <button (click)="deleteConfirm.set(null)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 transition-all cursor-pointer">
                No
              </button>
            } @else {
              <a [routerLink]="'/admin/threats/' + t.id"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 hover:border-green-500/40 transition-all">
                Editar
              </a>
              <button (click)="deleteConfirm.set(t.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-red-500/15 text-red-500/40
                       hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">
                Borrar
              </button>
            }
          </div>
        </li>
        }
      </ul>
      }

    </div>
  `,
})
export class ThreatList implements OnInit {
  private readonly auth = inject(AdminAuth);

  threats = signal<ThreatSummary[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  ngOnInit() {
    this.loadThreats();
  }

  async loadThreats(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/threats`);
      if (resp.ok) this.threats.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  async deleteThreat(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/threats/${id}`, {
        method: 'DELETE',
        headers: this.auth.authHeaders(),
      });
      this.threats.update(list => list.filter(t => t.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
