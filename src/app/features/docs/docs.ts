import { ChangeDetectorRef, Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, filter } from 'rxjs';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';
import { hydrateConfigVars } from '../../shared/markdown/config-hydrator';

const PDF_WORKER_URL = 'https://firmware-wars-api.josepec.eu/pdf';

interface DocsCategory {
  id: string;
  label: string;
  configUrl: string;
  docsPath: string;
}

const CATEGORIES: DocsCategory[] = [
  { id: 'reglamento', label: 'REGLAMENTO', configUrl: '/assets/config/docs.config.json', docsPath: 'assets/docs' },
  { id: 'recursos', label: 'RECURSOS', configUrl: '/assets/config/recursos.config.json', docsPath: 'assets/recursos' },
];

@Component({
  selector: 'app-docs',
  imports: [RouterLink, RouterLinkActive, MarkdownComponent],
  templateUrl: './docs.html',
  styleUrl: './docs.scss',
})
export class Docs implements OnInit, OnDestroy {
  readonly pdfUrl = PDF_WORKER_URL;
  markdownSrc = signal<string | null>(null);
  sections = signal<{ id: string; num: string; title: string; subtitle: string }[]>([]);
  currentSectionId = signal<string | null>(null);
  currentCategory = signal<DocsCategory>(CATEGORIES[0]);
  mobileMenuOpen = signal(false);

  currentSection = computed(() => {
    const id = this.currentSectionId();
    return this.sections().find(s => s.id === id) ?? null;
  });

  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private loadedCategory: string | null = null;
  private routerSub!: Subscription;

  toggleMobileMenu() { this.mobileMenuOpen.update(v => !v); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (this.mobileMenuOpen() && !(e.target as HTMLElement).closest('.mobile-nav-dropdown')) {
      this.mobileMenuOpen.set(false);
    }
  }

  ngOnInit() {
    this.parseUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.parseUrl(e.urlAfterRedirects));
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  private parseUrl(url: string): void {
    const parts = url.replace(/^\/docs\/?/, '').split('/').filter(Boolean);
    const categoryId = parts[0] || 'reglamento';
    const section = parts[1] || null;

    const cat = CATEGORIES.find(c => c.id === categoryId) ?? CATEGORIES[0];
    this.currentCategory.set(cat);
    this.currentSectionId.set(section);
    this.markdownSrc.set(section ? `${cat.docsPath}/${section}.md` : null);
    this.mobileMenuOpen.set(false);

    if (this.loadedCategory !== cat.id) {
      this.loadedCategory = cat.id;
      this.loadConfig(cat.configUrl);
    }
  }

  private async loadConfig(url: string): Promise<void> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const cfg = await resp.json();
      this.sections.set(cfg.sections ?? []);
    } catch {
      this.sections.set([]);
    }
    this.cdr.markForCheck();
  }

  onMarkdownReady(): void {
    hydrateJsonTables(this.el.nativeElement);
    hydrateConfigVars(this.el.nativeElement);
  }
}
