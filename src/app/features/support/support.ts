import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface Faq {
  id: string;
  question: string;
  answer: string;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'ratelimited';

@Component({
  selector: 'app-support',
  imports: [FormsModule, MarkdownComponent],
  styleUrl: './support.scss',
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">

      <!-- Cabecera -->
      <div class="flex items-center gap-3 sm:gap-4 mb-2">
        <span class="text-[9px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.5em] text-green-500/55">
          // HELPDESK.SYS
        </span>
        <div class="flex-1 h-px bg-green-500/15"></div>
      </div>
      <h1 class="font-orbitron text-2xl sm:text-3xl font-black tracking-tight text-green-400 uppercase mb-2">
        Soporte
      </h1>
      <p class="text-[10px] tracking-[0.2em] text-green-500/50 uppercase mb-10 leading-relaxed">
        Centro de soporte. Consulta la base de conocimiento o abre un ticket directo con el Product Owner.
      </p>

      <!-- ── FAQ ─────────────────────────────────────────────── -->
      <section class="mb-12">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-[9px] tracking-[0.3em] text-green-500/55">// FAQ.SYS</span>
          <div class="flex-1 h-px bg-green-500/15"></div>
          <span class="text-[9px] tracking-[0.3em] text-green-500/55 uppercase">Preguntas frecuentes</span>
        </div>

        @if (loadingFaqs()) {
          <div class="text-[10px] text-green-500/40 tracking-wider animate-pulse py-4">
            > CARGANDO FAQ.SYS...
          </div>
        } @else if (faqs().length === 0) {
          <div class="border border-green-500/15 bg-black/30 px-5 py-6 text-center
                      text-[10px] tracking-[0.2em] text-green-500/45">
            > FAQ.SYS SIN REGISTROS.
          </div>
        } @else {
          <div class="space-y-2">
            @for (f of faqs(); track f.id) {
              <div class="border border-green-500/15 bg-black/30">
                <button type="button" (click)="toggleFaq(f.id)"
                  class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer
                         hover:bg-green-500/5 transition-colors">
                  <span class="text-green-500/40 text-[10px] font-mono">
                    {{ openFaqId() === f.id ? '▾' : '▸' }}
                  </span>
                  <span class="text-[11px] sm:text-xs tracking-wider text-green-300 uppercase font-bold">
                    {{ f.question }}
                  </span>
                </button>
                @if (openFaqId() === f.id) {
                  <div class="px-5 pb-4 pt-1 border-t border-green-500/10">
                    <markdown [data]="f.answer" [disableSanitizer]="true" />
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>

      <!-- ── Consultar al Product Owner ───────────────────────── -->
      <section>
        <div class="flex items-center gap-3 mb-4">
          <span class="text-[9px] tracking-[0.3em] text-green-500/55">// CONSULTAR AL PRODUCT OWNER</span>
          <div class="flex-1 h-px bg-green-500/15"></div>
        </div>

        <div class="border border-green-500/20 bg-black/40 p-5 sm:p-6">
          <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-5 items-start mb-6">
            <!-- Retrato del PO con fallback -->
            @if (!poImgError()) {
              <img src="/assets/img/product-owner.png" alt="Product Owner"
                   (error)="poImgError.set(true)"
                   class="w-full max-w-[140px] border border-green-500/25 mx-auto sm:mx-0" />
            } @else {
              <div class="w-full max-w-[140px] aspect-square border border-dashed border-green-500/25
                          flex items-center justify-center text-center px-2 mx-auto sm:mx-0
                          text-[8px] tracking-[0.15em] text-green-500/40">
                [ PRODUCT_OWNER.PNG<br>— SEÑAL PERDIDA ]
              </div>
            }
            <div>
              <div class="font-mono text-[10px] sm:text-[11px] text-cyan-300/80 mb-3">
                $ ping product_owner --msg "tu_consulta"
              </div>
              <p class="text-[10px] tracking-[0.15em] text-green-400/70 uppercase leading-relaxed">
                El Product Owner procesa todas las consultas personalmente.
                Tiempo medio de respuesta: &lt;48 ciclos.
              </p>
            </div>
          </div>

          @if (sendState() === 'sent') {
            <div class="border border-green-400/40 bg-green-500/10 px-4 py-4 text-center
                        text-[10px] tracking-[0.2em] text-green-300">
              > CONSULTA TRANSMITIDA. RESPUESTA ESTIMADA: &lt;48 CICLOS.
            </div>
          } @else {
            <form (ngSubmit)="send()" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" [(ngModel)]="name" name="name" maxlength="80" required
                  placeholder="ALIAS / ID DE NODO"
                  class="w-full px-3 py-2 text-[11px] tracking-wider bg-green-500/5
                         border border-green-500/20 text-green-300 placeholder:text-green-500/30
                         focus:border-green-400/50 focus:outline-none" />
                <input type="email" [(ngModel)]="email" name="email" maxlength="120"
                  placeholder="CANAL DE RESPUESTA (OPCIONAL)"
                  class="w-full px-3 py-2 text-[11px] tracking-wider bg-green-500/5
                         border border-green-500/20 text-green-300 placeholder:text-green-500/30
                         focus:border-green-400/50 focus:outline-none" />
              </div>
              <!-- Honeypot: invisible para humanos, irresistible para bots -->
              <input type="text" [(ngModel)]="website" name="website" tabindex="-1"
                     autocomplete="off" aria-hidden="true" class="hp-field" />
              <textarea [(ngModel)]="message" name="message" rows="5" maxlength="2000" required
                placeholder="> ESCRIBE TU CONSULTA..."
                class="w-full px-3 py-2 text-[11px] tracking-wider bg-green-500/5
                       border border-green-500/20 text-green-300 placeholder:text-green-500/30
                       focus:border-green-400/50 focus:outline-none resize-y"></textarea>

              @if (validationError()) {
                <div class="text-[9px] tracking-[0.15em] text-yellow-400/80">
                  ⚠ {{ validationError() }}
                </div>
              }
              @if (sendState() === 'error') {
                <div class="text-[9px] tracking-[0.15em] text-red-400/80">
                  > ERROR DE TRANSMISIÓN. REINTENTA EN UNOS CICLOS.
                </div>
              }
              @if (sendState() === 'ratelimited') {
                <div class="text-[9px] tracking-[0.15em] text-orange-400/80">
                  > CANAL SATURADO. DEMASIADAS TRANSMISIONES — ESPERA 1 HORA.
                </div>
              }

              <button type="submit" [disabled]="sendState() === 'sending'"
                class="w-full px-4 py-3 text-[11px] tracking-[0.25em] uppercase font-bold
                       bg-green-500/10 border border-green-500/30 text-green-400
                       hover:bg-green-500/20 hover:border-green-400/50 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                @if (sendState() === 'sending') { TRANSMITIENDO... } @else { TRANSMITIR CONSULTA }
              </button>
            </form>
          }
        </div>
      </section>
    </div>
  `,
})
export class Support implements OnInit {
  private readonly titleSvc = inject(Title);

  faqs = signal<Faq[]>([]);
  loadingFaqs = signal(true);
  openFaqId = signal<string | null>(null);
  poImgError = signal(false);

  name = '';
  email = '';
  message = '';
  /** Honeypot — los humanos no lo ven; si llega relleno, el backend lo descarta. */
  website = '';
  sendState = signal<SendState>('idle');
  validationError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.titleSvc.setTitle('Soporte · Firmware Wars');
    try {
      const r = await fetch(`${API_URL}/api/faqs`);
      if (r.ok) this.faqs.set(await r.json());
    } catch { /* estado vacío */ }
    this.loadingFaqs.set(false);
  }

  toggleFaq(id: string): void {
    this.openFaqId.update(cur => (cur === id ? null : id));
  }

  async send(): Promise<void> {
    this.validationError.set(null);
    const name = this.name.trim();
    const message = this.message.trim();
    if (!name) {
      this.validationError.set('Indica tu alias / ID de nodo.');
      return;
    }
    if (message.length < 10) {
      this.validationError.set('La consulta debe tener al menos 10 caracteres.');
      return;
    }
    this.sendState.set('sending');
    try {
      const r = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: this.email.trim() || undefined,
          message,
          website: this.website || undefined,
        }),
      });
      if (r.status === 429) {
        this.sendState.set('ratelimited');
        return;
      }
      this.sendState.set(r.ok ? 'sent' : 'error');
    } catch {
      this.sendState.set('error');
    }
  }
}
