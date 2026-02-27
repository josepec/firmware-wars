import { Component, NgZone, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';

const PDF_WORKER_URL = 'https://firmware-wars-api.josepec.eu/pdf';

@Component({
  selector: 'app-docs-print',
  imports: [RouterLink, MarkdownComponent],
  templateUrl: './docs-print.html',
  styleUrl: './docs-print.scss',
})
export class DocsPrint implements OnDestroy {
  readonly sections = [
    { id: 'intro', num: '01', title: 'INIT.SYS', subtitle: 'Introducción' },
    { id: 'ambient', num: '02', title: 'AMBIENT.DSK', subtitle: 'Ambientación' },
    { id: 'hardware', num: '03', title: 'HARDWARE.CFG', subtitle: 'Componentes' },
    { id: 'setup', num: '04', title: 'SETUP.PRT', subtitle: 'Preparación' },
    { id: 'core-cycle', num: '05', title: 'CORE.CYCLE', subtitle: 'Ciclo de Turno' },
    { id: 'bots', num: '06', title: 'BOTS.CFG', subtitle: 'Unidades de Combate' },
    { id: 'tables', num: '07', title: 'TECH.REF', subtitle: 'Referencia Técnica' },
    { id: 'quick-ref', num: '08', title: 'QUICK.REF', subtitle: 'Referencia Rápida' },
  ];

  readonly pdfUrl = PDF_WORKER_URL;

  /* Cuando el Worker llama a la página añade ?worker=1.
     En ese modo no llamamos a window.print() ni navegamos de vuelta. */
  private readonly isWorkerRequest = new URLSearchParams(window.location.search).has('worker');

  /* ── 1 mm en px CSS (calculado una vez al montar) ────────── */
  private readonly oneMmPx: number;

  private sectionsLoaded = 0;
  private autoPrinted = false;

  private readonly beforePrintFn = () => this.clearColumnHeights();
  private readonly afterPrintFn = () => {
    if (!this.isWorkerRequest) {
      this.router.navigate(['/docs']);
    }
  };

  constructor(
    private readonly ngZone: NgZone,
    private readonly router: Router,
  ) {
    const probe = document.createElement('div');
    probe.style.cssText = 'width:1mm;position:absolute;visibility:hidden;';
    document.body.appendChild(probe);
    this.oneMmPx = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);

    if (this.isWorkerRequest) {
      document.body.setAttribute('data-worker', 'true');
    }

    window.addEventListener('beforeprint', this.beforePrintFn);
    window.addEventListener('afterprint', this.afterPrintFn);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeprint', this.beforePrintFn);
    window.removeEventListener('afterprint', this.afterPrintFn);
  }

  print(): void {
    window.print();
  }

  /**
   * Llamado por (load) y (error) de cada <markdown>.
   * Cuando todas las secciones están listas, aplica alturas y señaliza al Worker.
   * En el browser del usuario además lanza el diálogo de impresión.
   */
  onSectionReady(): void {
    this.sectionsLoaded++;
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.applyColumnHeights();
          if (!this.autoPrinted && this.sectionsLoaded >= this.sections.length) {
            this.autoPrinted = true;
            if (this.isWorkerRequest) {
              this.injectPageNumbers();
            }
            document.body.setAttribute('data-pdf-ready', 'true');
            if (!this.isWorkerRequest) {
              window.print();
            }
          }
        })
      );
    });
  }

  /* ── Paginator ──────────────────────────────────────────── */

  private applyColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.fw-page.content-page').forEach(page => {
      this.paginatePage(page);
    });
  }

  private paginatePage(page: HTMLElement): void {
    const sectionHeader = page.querySelector<HTMLElement>('.section-header');
    const markdownEl = page.querySelector<HTMLElement>('markdown');
    if (!sectionHeader || !markdownEl) return;

    /* Altura A5 en px CSS */
    const a5Px = 210 * this.oneMmPx;

    /* Padding del .content-page (2cm arriba + 1.8cm abajo) */
    const style = getComputedStyle(page);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);

    /* Altura total del section-header incluyendo su margin-bottom */
    const headerStyle = getComputedStyle(sectionHeader);
    const headerHeight = sectionHeader.getBoundingClientRect().height
      + parseFloat(headerStyle.marginBottom || '0');

    /* Espacio disponible para el contenido markdown */
    const contentAreaPx = a5Px - paddingTop - paddingBottom - headerHeight;
    if (contentAreaPx < 30) return;

    /* Para cada bloque de columnas, calcula el espacio restante
       descontando el contenido markdown que hay por encima de él
       (h1, párrafos introductores, etc.)                        */
    const mdTop = markdownEl.getBoundingClientRect().top;

    markdownEl.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      const contentAbove = col.getBoundingClientRect().top - mdTop;
      const colHeight = contentAreaPx - contentAbove;

      if (colHeight > 30) {
        col.style.height = `${colHeight}px`;
        col.style.columnFill = 'auto';
        /* overflow visible: el exceso crea columnas adicionales a la
           derecha (igual que ocurriría en la siguiente página al imprimir).
           No se pierde contenido; se ve fuera del box A5.              */
        col.style.overflow = 'visible';
      }
    });
  }

  /** Inyecta números de página en cada .fw-page (modo Worker/Puppeteer).
   *  Pares a la izquierda, impares a la derecha, portada sin número. */
  private injectPageNumbers(): void {
    const pages = Array.from(document.querySelectorAll<HTMLElement>('.fw-page'));
    pages.forEach((page, i) => {
      if (i === 0) return; // portada sin número
      const pageNum = i + 1;
      const el = document.createElement('div');
      el.className = 'pdf-page-num';
      el.dataset['side'] = pageNum % 2 === 0 ? 'left' : 'right';
      el.textContent = String(pageNum);
      page.appendChild(el);
    });
  }

  /** Limpia alturas inline antes de imprimir para no interferir con @page */
  private clearColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      col.style.removeProperty('height');
      col.style.removeProperty('column-fill');
      col.style.removeProperty('overflow');
    });
  }
}
