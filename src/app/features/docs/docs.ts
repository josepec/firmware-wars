import { Component, ElementRef, OnInit } from '@angular/core';
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
  sections: { id: string; num: string; title: string; subtitle: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private el: ElementRef<HTMLElement>,
  ) { }

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const section = params.get('section');
      this.markdownSrc = section ? `assets/docs/${section}.md` : null;
    });

    try {
      const resp = await fetch('/assets/config/docs.config.json');
      const cfg = await resp.json();
      this.sections = cfg.sections;
    } catch (e) {
      console.error('[docs] Error loading config:', e);
    }
  }

  onMarkdownReady(): void {
    hydrateJsonTables(this.el.nativeElement);
  }
}
