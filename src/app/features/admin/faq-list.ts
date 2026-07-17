import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface FaqRow {
  id: string;
  question: string;
  sort_order: number;
  published: number;
}

@Component({
  selector: 'app-faq-list',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN · FAQ.SYS</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">FAQs</h1>
        </div>
        <a routerLink="/admin/faqs/new"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 hover:border-green-400/50 transition-all">
          + Nueva
        </a>
      </div>

      @if (loading()) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">> LOADING...</div>
      } @else if (faqs().length === 0) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">> No hay FAQs creadas.</div>
      } @else {
        <div class="border border-green-500/15 divide-y divide-green-500/10">
          @for (f of faqs(); track f.id) {
            <div class="flex items-center gap-3 px-4 py-3 hover:bg-green-500/3 transition-colors">
              <span class="text-[9px] font-mono text-green-500/40 w-8 shrink-0">#{{ f.sort_order }}</span>
              <div class="flex-1 min-w-0 flex items-center gap-2">
                <span class="text-[11px] tracking-wider text-green-300 truncate">{{ f.question }}</span>
                @if (!f.published) {
                  <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                               border border-yellow-400/50 bg-yellow-500/10 text-yellow-300 shrink-0">Oculta</span>
                }
              </div>
              @if (deleteConfirm() === f.id) {
                <button (click)="deleteFaq(f.id)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase bg-red-500/10 border border-red-500/30
                         text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">Si</button>
                <button (click)="deleteConfirm.set(null)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                         text-green-500/50 hover:text-green-400 transition-all cursor-pointer">No</button>
              } @else {
                <a [routerLink]="'/admin/faqs/' + f.id"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                         text-green-500/50 hover:text-green-400 hover:border-green-500/40 transition-all">Ed</a>
                <button (click)="deleteConfirm.set(f.id)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-red-500/15
                         text-red-500/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">X</button>
              }
            </div>
          }
        </div>
        <p class="mt-3 text-[9px] text-green-500/30 tracking-wider">
          El orden público es el campo # ascendente.
        </p>
      }
    </div>
  `,
})
export class FaqList implements OnInit {
  private readonly auth = inject(AdminAuth);

  faqs = signal<FaqRow[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  ngOnInit() {
    this.loadFaqs();
  }

  async loadFaqs(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/faqs`, { headers: this.auth.authHeaders() });
      if (resp.ok) this.faqs.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  async deleteFaq(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/faqs/${id}`, { method: 'DELETE', headers: this.auth.authHeaders() });
      this.faqs.update(list => list.filter(f => f.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
