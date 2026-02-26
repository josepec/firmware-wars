import { Component, NgZone, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';

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

  /* ── 1 mm en px CSS (calculado una vez al montar) ────────── */
  private readonly oneMmPx: number;

  /* ── Handlers de impresión como propiedades para poder      *
   *    desregistrarlos correctamente en ngOnDestroy            */
  private readonly beforePrintFn = () => this.clearColumnHeights();
  private readonly afterPrintFn = () => this.applyColumnHeights();

  constructor(private readonly ngZone: NgZone) {
    /* Calcula 1 mm en px CSS midiendo un elemento temporal */
    const probe = document.createElement('div');
    probe.style.cssText = 'width:1mm;position:absolute;visibility:hidden;';
    document.body.appendChild(probe);
    this.oneMmPx = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);

    /* Al imprimir: quita alturas JS para que @page las controle;
       al volver: las restaura para la vista previa.            */
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
   * Doble rAF garantiza que el layout ya está pintado.
   */
  onSectionReady(): void {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this.applyColumnHeights())
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

  /** Limpia alturas inline antes de imprimir para no interferir con @page */
  private clearColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      col.style.removeProperty('height');
      col.style.removeProperty('column-fill');
      col.style.removeProperty('overflow');
    });
  }
}
