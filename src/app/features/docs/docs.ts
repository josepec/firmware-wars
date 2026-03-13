import { ChangeDetectorRef, Component, computed, ElementRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';
import { hydrateConfigVars } from '../../shared/markdown/config-hydrator';

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
  currentSectionId = signal<string | null>(null);
  mobileMenuOpen = signal(false);

  currentSection = computed(() => {
    const id = this.currentSectionId();
    return this.sections().find(s => s.id === id) ?? null;
  });

  private readonly route = inject(ActivatedRoute);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  toggleMobileMenu() { this.mobileMenuOpen.update(v => !v); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (this.mobileMenuOpen() && !(e.target as HTMLElement).closest('.mobile-nav-dropdown')) {
      this.mobileMenuOpen.set(false);
    }
  }

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const section = params.get('section');
      this.currentSectionId.set(section);
      this.markdownSrc = section ? `assets/docs/${section}.md` : null;
      this.mobileMenuOpen.set(false);
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
    hydrateConfigVars(this.el.nativeElement);
  }
}
