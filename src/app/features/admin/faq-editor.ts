import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-faq-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">

      <a routerLink="/admin/faqs"
         class="text-[10px] tracking-[0.25em] text-green-500/50 hover:text-green-300 uppercase">← FAQs</a>

      <h1 class="mt-4 mb-6 text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
          style="font-family: 'Orbitron', monospace;">
        {{ editId ? 'Editar FAQ' : 'Nueva FAQ' }}
      </h1>

      <div class="space-y-4">
        <div>
          <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">Pregunta</label>
          <input type="text" [ngModel]="question()" (ngModelChange)="question.set($event)" maxlength="300"
            class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                   focus:border-green-400/50 focus:outline-none" />
        </div>

        <div>
          <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">Respuesta (markdown)</label>
          <textarea [ngModel]="answer()" (ngModelChange)="answer.set($event)" rows="8"
            class="w-full px-3 py-2 text-[12px] font-mono leading-relaxed bg-green-500/5
                   border border-green-500/20 text-green-300 focus:border-green-400/50
                   focus:outline-none resize-y"></textarea>
        </div>

        <div class="flex items-center gap-6">
          <div>
            <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">Orden</label>
            <input type="number" [ngModel]="sortOrder()" (ngModelChange)="sortOrder.set($event)"
              class="w-24 px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                     focus:border-green-400/50 focus:outline-none" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer select-none mt-5">
            <input type="checkbox" [ngModel]="published()" (ngModelChange)="published.set($event)"
                   class="accent-green-500" />
            <span class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Publicada</span>
          </label>
        </div>

        @if (error()) {
          <div class="text-[10px] tracking-[0.2em] text-red-400/80">> {{ error() }}</div>
        }

        <button type="button" (click)="save()" [disabled]="saving()"
          class="px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase bg-green-500/10 border
                 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-400/50
                 transition-all disabled:opacity-40 cursor-pointer">
          @if (saving()) { GUARDANDO... } @else { Guardar }
        </button>
      </div>
    </div>
  `,
})
export class FaqEditor implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  editId: string | null = null;
  question = signal('');
  answer = signal('');
  sortOrder = signal(0);
  published = signal(true);
  saving = signal(false);
  error = signal('');

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/scenarios']);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.editId = id;
      try {
        // El GET admin de /api/faqs devuelve todas; carga y localiza la fila
        const r = await fetch(`${API_URL}/api/faqs`, { headers: this.auth.authHeaders() });
        if (r.ok) {
          const rows = (await r.json()) as Array<{ id: string; question: string; answer: string; sort_order: number; published: number }>;
          const f = rows.find(x => x.id === id);
          if (f) {
            this.question.set(f.question);
            this.answer.set(f.answer);
            this.sortOrder.set(f.sort_order);
            this.published.set(!!f.published);
          }
        }
      } catch { /* ignore */ }
    }
  }

  async save(): Promise<void> {
    this.error.set('');
    if (!this.question().trim()) {
      this.error.set('La pregunta es obligatoria.');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        question: this.question().trim(),
        answer: this.answer(),
        sortOrder: Math.trunc(Number(this.sortOrder()) || 0),
        published: this.published(),
      };
      const url = this.editId ? `${API_URL}/api/faqs/${this.editId}` : `${API_URL}/api/faqs`;
      const resp = await fetch(url, {
        method: this.editId ? 'PUT' : 'POST',
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `API error ${resp.status}` }));
        this.error.set(err.error ?? `API error ${resp.status}`);
      } else {
        this.router.navigate(['/admin/faqs']);
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.saving.set(false);
  }
}
