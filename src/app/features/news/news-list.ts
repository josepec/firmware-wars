import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

const API_URL = 'https://firmware-wars-api.josepec.eu';

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  header_image: string | null;
  published_at: string;
}

@Component({
  selector: 'app-news-list',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <!-- Cabecera de sección -->
      <div class="flex items-center gap-3 sm:gap-4 mb-2">
        <span class="text-xs tracking-[0.15em] sm:tracking-[0.5em] text-green-400/80 whitespace-nowrap shrink-0">
          // PATCH_NOTES.LOG
        </span>
        <div class="flex-1 h-px bg-green-500/15"></div>
      </div>
      <h1 class="font-orbitron text-2xl sm:text-3xl font-black tracking-tight text-green-400 uppercase mb-2">
        Noticias
      </h1>
      <p class="text-xs tracking-[0.12em] text-green-400/80 uppercase mb-8 leading-relaxed">
        Registro de actualizaciones del sistema — novedades, cambios y comunicados
      </p>

      @if (loading()) {
        <div class="text-xs text-green-400/85 tracking-wider animate-pulse py-8">
          > CARGANDO PATCH_NOTES.LOG...
        </div>
      } @else if (posts().length === 0) {
        <div class="border border-green-500/15 bg-black/30 px-5 py-8 text-center
                    text-xs tracking-[0.15em] text-green-400/80">
          > PATCH_NOTES.LOG VACÍO. VUELVE EN EL PRÓXIMO CICLO.
        </div>
      } @else {
        <div class="space-y-4">
          @for (p of posts(); track p.id) {
            <a [routerLink]="['/noticias', p.slug]"
               class="block border border-green-500/15 bg-black/30 hover:border-green-400/40
                      hover:bg-green-500/5 transition-all group overflow-hidden">
              @if (p.header_image) {
                <img [src]="p.header_image" [alt]="p.title"
                     class="w-full max-h-56 object-cover border-b border-green-500/10" />
              }
              <div class="px-5 py-4">
                <div class="text-xs tracking-[0.15em] text-green-400/80 mb-1">
                  {{ p.published_at | date: 'dd/MM/yyyy' }}
                </div>
                <div class="font-orbitron text-[15px] sm:text-base font-bold tracking-wide
                            text-green-300 group-hover:text-green-200 uppercase">
                  {{ p.title }}
                </div>
                <div class="mt-2 text-xs tracking-[0.15em] text-cyan-400/80
                            group-hover:text-cyan-300 uppercase">
                  Leer entrada →
                </div>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class NewsList implements OnInit {
  private readonly titleSvc = inject(Title);

  posts = signal<PostSummary[]>([]);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.titleSvc.setTitle('Noticias · Firmware Wars');
    try {
      const r = await fetch(`${API_URL}/api/posts`);
      if (r.ok) this.posts.set(await r.json());
    } catch { /* estado vacío */ }
    this.loading.set(false);
  }
}
