import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';

const PDF_WORKER_URL = 'https://firmware-wars-api.josepec.eu/pdf';

@Component({
  selector: 'app-docs',
  imports: [RouterLink, RouterLinkActive, MarkdownComponent],
  templateUrl: './docs.html',
  styleUrl: './docs.scss',
})
export class Docs implements OnInit {
  readonly pdfUrl = PDF_WORKER_URL;
  markdownSrc: string | null = null;
  sections = signal<{ id: string; num: string; title: string; subtitle: string }[]>([]);

  private readonly route = inject(ActivatedRoute);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const section = params.get('section');
      this.markdownSrc = section ? `assets/docs/${section}.md` : null;
    });

    try {
      const resp = await fetch('/assets/config/docs.config.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const cfg = await resp.json();
      this.sections.set(cfg.sections ?? []);
      this.cdr.markForCheck();
    } catch (e) {
      console.error('[docs] Error loading config:', e);
    }
  }

  onMarkdownReady(): void {
    hydrateJsonTables(this.el.nativeElement);
  }
}
