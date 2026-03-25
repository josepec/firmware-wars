import { ChangeDetectorRef, Component, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { CoverPage } from './cover-page';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';
import { hydrateConfigVars } from '../../shared/markdown/config-hydrator';

const PDF_WORKER_URL = 'https://firmware-wars-api.josepec.eu/campaign-pdf';
@Component({
  selector: 'app-campaign-print',
  imports: [RouterLink, MarkdownComponent, CoverPage],
  templateUrl: './campaign-print.html',
  styleUrl: './docs-print.scss',
})
export class CampaignPrint implements OnDestroy {
  sections = signal<{ id: string; num: string; title: string; subtitle: string; blankAfter?: boolean }[]>([]);
  readonly pdfUrl = PDF_WORKER_URL;
  readonly copyrightYears = new Date().getFullYear() > 2026
    ? `2026-${new Date().getFullYear()}`
    : '2026';

  private readonly isWorkerRequest = new URLSearchParams(window.location.search).has('worker');

  private readonly oneMmPx: number;

  private sectionsLoaded = 0;
  private autoPrinted = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  private readonly beforePrintFn = () => this.clearColumnHeights();
  private readonly afterPrintFn = () => {
    if (!this.isWorkerRequest) {
      this.router.navigate(['/docs/campaign']);
    }
  };

  constructor() {
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
      const resp = await fetch('/assets/config/campaign.config.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const cfg = await resp.json();
      this.sections.set(cfg.sections ?? []);
      this.cdr.markForCheck();
    } catch (e) {
      console.error('[campaign-print] Error loading config:', e);
      document.body.setAttribute('data-pdf-ready', 'true');
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeprint', this.beforePrintFn);
    window.removeEventListener('afterprint', this.afterPrintFn);
  }

  print(): void {
    window.print();
  }

  onSectionReady(): void {
    this.sectionsLoaded++;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.applyColumnHeights();
        if (!this.autoPrinted && this.sectionsLoaded >= this.sections().length) {
          this.autoPrinted = true;
          this.hydrateAndFinalize();
        }
      })
    );
  }

  private async hydrateAndFinalize(): Promise<void> {
    await Promise.all([hydrateJsonTables(document.body), hydrateConfigVars(document.body)]);
    this.applyColumnHeights();
    document.body.setAttribute('data-pdf-ready', 'true');
    if (!this.isWorkerRequest) {
      window.print();
    }
  }

  private applyColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.fw-page.content-page').forEach(page => {
      this.paginatePage(page);
    });
  }

  private paginatePage(page: HTMLElement): void {
    const sectionHeader = page.querySelector<HTMLElement>('.section-header');
    const markdownEl = page.querySelector<HTMLElement>('markdown');
    if (!sectionHeader || !markdownEl) return;

    const a5Px = 210 * this.oneMmPx;

    const style = getComputedStyle(page);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);

    const headerStyle = getComputedStyle(sectionHeader);
    const headerHeight = sectionHeader.getBoundingClientRect().height
      + parseFloat(headerStyle.marginBottom || '0');

    const contentAreaPx = a5Px - paddingTop - paddingBottom - headerHeight;
    if (contentAreaPx < 30) return;

    const mdTop = markdownEl.getBoundingClientRect().top;

    markdownEl.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      const contentAbove = col.getBoundingClientRect().top - mdTop;
      const colHeight = contentAreaPx - contentAbove;

      if (colHeight > 30) {
        col.style.height = `${colHeight}px`;
        col.style.columnFill = 'auto';
        col.style.overflow = 'visible';
      }
    });
  }

  private clearColumnHeights(): void {
    document.querySelectorAll<HTMLElement>('.md-col-2, .md-col-3').forEach(col => {
      col.style.removeProperty('height');
      col.style.removeProperty('column-fill');
      col.style.removeProperty('overflow');
    });
  }
}
