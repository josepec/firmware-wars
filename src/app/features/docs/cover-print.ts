import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CoverPage } from './cover-page';

/**
 * Ruta aislada que renderiza SOLO la portada.
 * Puppeteer la usa para generar un PDF de 1 página idéntico
 * para el manual y para escenarios.
 *
 * Query params:
 *   ?subtitle=Escenarios+y+Amenazas
 *   &image=assets/img/cover-scenarios.png
 *   &systemLine=Core+Combat+System   (opcional)
 *   &worker=1                         (modo Puppeteer)
 */
@Component({
  selector: 'app-cover-print',
  encapsulation: ViewEncapsulation.None,
  imports: [CoverPage],
  template: `
    <div class="cover-page-wrapper">
      <app-cover-page
        [imageSrc]="image"
        [subtitle]="subtitle"
        [systemLine]="systemLine"
        [copyrightYears]="copyrightYears" />
    </div>
  `,
  styles: [`
    @page {
      size: A5;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
    }

    .cover-page-wrapper {
      /* Pantalla: preview A5 */
      width: 148mm;
      height: 210mm;
      overflow: hidden;
      margin: 0 auto;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      /* Padding simula los márgenes de página: 1.5cm top, 1.8cm sides, 1.2cm bottom */
      padding: 1.5cm 1.8cm 1.2cm;
      box-sizing: border-box;
    }

    @media print {
      .cover-page-wrapper {
        /* En print: exactamente A5, sin márgenes externos */
        width: 148mm;
        height: 210mm;
        overflow: hidden;
        margin: 0;
        box-shadow: none;
      }
    }
  `],
})
export class CoverPrint implements OnInit {
  subtitle = '';
  image = '';
  systemLine: string | undefined;
  copyrightYears: string;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.subtitle = params.get('subtitle') ?? '';
    this.image = params.get('image') ?? '';
    this.systemLine = params.get('systemLine') ?? undefined;

    const year = new Date().getFullYear();
    this.copyrightYears = year > 2026 ? `2026-${year}` : '2026';
  }

  ngOnInit(): void {
    // Esperar a que las fuentes estén listas antes de señalizar
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        document.body.setAttribute('data-pdf-ready', 'true');
      });
    } else {
      // Fallback: señalizar tras un breve delay
      setTimeout(() => document.body.setAttribute('data-pdf-ready', 'true'), 500);
    }
  }
}
