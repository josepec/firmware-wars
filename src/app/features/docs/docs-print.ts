import { Component, NgZone, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';

const PDF_WORKER_URL = 'https://firmware-wars-api.josepec.eu/pdf';

@Component({
  selector: 'app-docs-print',
  imports: [RouterLink, MarkdownComponent],
  templateUrl: './docs-print.html',
  styleUrl: './docs-print.scss',
})
export class DocsPrint implements OnDestroy {
  sections: { id: string; num: string; title: string; subtitle: string }[] = [];

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

    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const resp = await fetch('/assets/config/docs.config.json');
      const cfg = await resp.json();
      this.ngZone.run(() => { this.sections = cfg.sections; });
    } catch (e) {
      console.error('[docs-print] Error loading config:', e);
    }
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
            this.hydrateAndFinalize();
          }
        })
      );
    });
  }

  private async hydrateAndFinalize(): Promise<void> {
    await hydrateJsonTables(document.body);
    /* Re-apply column heights after tables have been injected */
    this.applyColumnHeights();
    document.body.setAttribute('data-pdf-ready', 'true');
    if (!this.isWorkerRequest) {
      window.print();
    }
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

  /** Limpia alturas inline antes de imprimir para no interferir con @page */
  private clearColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      col.style.removeProperty('height');
      col.style.removeProperty('column-fill');
      col.style.removeProperty('overflow');
    });
  }
}
