import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppConfig } from '../../core/services/app-config';

interface MoreItem {
  label: string;
  hint: string;
  link: string;
  fragment?: string;
}

/**
 * MORE.SYS — destino de la pestaña «Más» de la tab bar móvil.
 * Sólo agrupa accesos a páginas que ya existen; no aporta contenido propio.
 */
@Component({
  selector: 'app-more',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto relative z-20">

      <div class="flex items-center gap-3 sm:gap-4 mb-2">
        <span class="text-xs tracking-[0.2em] sm:tracking-[0.4em] text-green-400/80 whitespace-nowrap shrink-0">
          // MORE.SYS
        </span>
        <div class="flex-1 h-px bg-green-500/15"></div>
      </div>
      <h1 class="font-orbitron text-2xl sm:text-3xl font-black tracking-tight text-green-300 uppercase mb-8">
        Más
      </h1>

      <div class="flex flex-col gap-2">
        @for (m of items(); track m.link + (m.fragment ?? '')) {
          <a [routerLink]="m.link" [fragment]="m.fragment"
             class="flex items-center justify-between gap-4 min-h-[56px] px-4 py-3
                    border border-green-500/20 bg-black/40
                    hover:border-green-400/40 hover:bg-green-500/5 transition-all">
            <span class="flex flex-col gap-1 min-w-0">
              <span class="text-sm tracking-[0.1em] text-green-300">{{ m.label }}</span>
              <span class="text-xs text-green-400/85">{{ m.hint }}</span>
            </span>
            <span class="text-green-400/85 shrink-0" aria-hidden="true">→</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class More implements OnInit {
  private readonly titleSvc = inject(Title);
  private readonly appConfig = inject(AppConfig);

  readonly items = signal<MoreItem[]>([]);

  async ngOnInit(): Promise<void> {
    this.titleSvc.setTitle('Más · Firmware Wars');

    // Los subtítulos reutilizan literalmente los rótulos de cada página destino.
    const items: MoreItem[] = [];
    if (await this.appConfig.isCategoryVisible('noticias')) {
      items.push({ label: 'Noticias', hint: 'Registro de actualizaciones del sistema', link: '/noticias' });
    }
    if (await this.appConfig.isCategoryVisible('soporte')) {
      items.push({ label: 'Soporte', hint: 'Preguntas frecuentes', link: '/soporte' });
    }
    items.push({ label: 'Cómo se juega', hint: 'Tu primer turno, compilado en 8 pasos', link: '/', fragment: 'quick-start' });
    this.items.set(items);
  }
}
