import { ChangeDetectorRef, Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, filter } from 'rxjs';
import { hydrateJsonTables } from '../../shared/markdown/json-table-hydrator';
import { hydrateConfigVars } from '../../shared/markdown/config-hydrator';
import { DocsSearchIndex, SearchResult } from './docs-search';
import { ScenarioViewer } from './scenario-viewer';
import { ThreatViewer } from './threat-viewer';
import { AppConfig } from '../../core/services/app-config';

const API_URL = 'https://firmware-wars-api.josepec.eu';
const PDF_WORKER_URL = `${API_URL}/pdf`;
const SCENARIOS_PDF_URL = `${API_URL}/scenarios-pdf`;
const CAMPAIGN_PDF_URL = `${API_URL}/campaign-pdf`;

interface DocsCategory {
  id: string;
  label: string;
  configUrl: string;
  docsPath: string;
  searchable: boolean;
}

const CATEGORIES: DocsCategory[] = [
  { id: 'reglamento', label: 'REGLAMENTO', configUrl: '/assets/config/docs.config.json', docsPath: 'assets/docs', searchable: true },
  { id: 'campaign', label: 'CAMPAÑA', configUrl: '/assets/config/campaign.config.json', docsPath: 'assets/docs/campaign', searchable: false },
  { id: 'escenarios', label: 'ESCENARIOS', configUrl: '', docsPath: '', searchable: false },
  { id: 'recursos', label: 'RECURSOS', configUrl: '/assets/config/recursos.config.json', docsPath: 'assets/recursos', searchable: false },
];

@Component({
  selector: 'app-docs',
  imports: [RouterLink, RouterLinkActive, MarkdownComponent, ScenarioViewer, ThreatViewer],
  templateUrl: './docs.html',
  styleUrl: './docs.scss',
})
export class Docs implements OnInit, OnDestroy {
  private readonly appConfig = inject(AppConfig);
  readonly pdfUrl = PDF_WORKER_URL;
  readonly scenariosPdfUrl = SCENARIOS_PDF_URL;
  readonly campaignPdfUrl = CAMPAIGN_PDF_URL;
  markdownSrc = signal<string | null>(null);
  sections = signal<{ id: string; num: string; title: string; subtitle: string; type?: string }[]>([]);
  currentSectionId = signal<string | null>(null);
  currentCategory = signal<DocsCategory>(CATEGORIES[0]);
  mobileMenuOpen = signal(false);

  /* ── Search ──────────────────────────────────────────────── */
  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  searchActive = signal(false);
  private searchIndex = new DocsSearchIndex();
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingScroll: { matchText: string; query: string } | null = null;

  currentSection = computed(() => {
    const id = this.currentSectionId();
    return this.sections().find(s => s.id === id) ?? null;
  });

  isThreatSection = computed(() => this.currentSection()?.type === 'threat');

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

  async ngOnInit() {
    await this.initCategories();
    this.parseUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.parseUrl(e.urlAfterRedirects));
  }

  private visibleIds = new Set(CATEGORIES.map(c => c.id));

  private async initCategories(): Promise<void> {
    const visible = new Set<string>();
    for (const c of CATEGORIES) {
      if (await this.appConfig.isCategoryVisible(c.id)) visible.add(c.id);
    }
    this.visibleIds = visible;
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  /* ── Search methods ──────────────────────────────────────── */

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (!value) {
      this.searchResults.set([]);
      this.searchActive.set(false);
      return;
    }

    this.searchTimeout = setTimeout(async () => {
      try {
        const cat = this.currentCategory();
        if (!cat.searchable) return;
        await this.searchIndex.build(cat.configUrl, cat.docsPath);
        const results = this.searchIndex.search(value);
        this.searchResults.set(results);
        this.searchActive.set(results.length > 0 || value.length >= 2);
        this.cdr.markForCheck();
      } catch (e) {
        console.error('[docs] search error:', e);
        this.searchResults.set([]);
        this.searchActive.set(true);
        this.cdr.markForCheck();
      }
    }, 200);
  }

  goToResult(result: SearchResult): void {
    const cat = this.currentCategory();
    const scrollData = { matchText: result.matchText, query: this.searchQuery() };
    const alreadyOnSection = this.currentSectionId() === result.sectionId;

    this.searchActive.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);

    if (alreadyOnSection) {
      setTimeout(() => {
        if (!this.scrollToMatchingElement(scrollData.matchText)) {
          this.scrollToMatchingElement(scrollData.query);
        }
      }, 50);
    } else {
      this.pendingScroll = scrollData;
      this.router.navigate(['/docs', cat.id, result.sectionId]);
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchActive.set(false);
  }

  highlightSnippet(snippet: string): string {
    const q = this.searchQuery();
    if (!q || q.length < 2) return this.escapeHtml(snippet);
    const escaped = this.escapeHtml(snippet);
    const regex = new RegExp(`(${this.escapeRegex(q)})`, 'gi');
    return escaped.replace(regex, '<mark class="bg-green-500/30 text-green-200 px-0.5">$1</mark>');
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ── URL & config ────────────────────────────────────────── */

  private parseUrl(url: string): void {
    const parts = url.replace(/^\/docs\/?/, '').split('/').filter(Boolean);
    const categoryId = parts[0] || 'reglamento';
    const section = parts[1] || null;

    const cat = CATEGORIES.find(c => c.id === categoryId && this.visibleIds.has(c.id)) ?? CATEGORIES[0];
    this.currentCategory.set(cat);
    this.currentSectionId.set(section);
    this.markdownSrc.set(cat.id !== 'escenarios' && section ? `${cat.docsPath}/${section}.md` : null);
    this.mobileMenuOpen.set(false);

    if (this.loadedCategory !== cat.id) {
      this.loadedCategory = cat.id;
      this.loadConfig(cat.configUrl);
    }
  }

  private async loadConfig(url: string): Promise<void> {
    const cat = this.currentCategory();

    if (cat.id === 'escenarios') {
      try {
        const [scenarioResp, threatResp] = await Promise.all([
          fetch(`${API_URL}/api/scenarios?full`),
          fetch(`${API_URL}/api/threats`),
        ]);
        const items: { id: string; num: string; title: string; subtitle: string; type?: string }[] = [];
        if (scenarioResp.ok) {
          const scenarios: { id: string; title: string; data?: any }[] = await scenarioResp.json();
          scenarios.sort((a, b) => (a.data?.numeroEscenario ?? 0) - (b.data?.numeroEscenario ?? 0));
          for (const s of scenarios) {
            const n = s.data?.numeroEscenario ?? 0;
            items.push({ id: s.id, num: String(n).padStart(2, '0'), title: s.title, subtitle: s.title, type: 'scenario' });
          }
        }
        if (threatResp.ok) {
          const threats: { id: string; name: string }[] = await threatResp.json();
          if (threats.length > 0) {
            items.push({ id: '__amenazas_header__', num: '', title: '// AMENAZAS', subtitle: '// AMENAZAS', type: 'header' });
            for (let i = 0; i < threats.length; i++) {
              items.push({ id: threats[i].id, num: String(i + 1).padStart(2, '0'), title: threats[i].name, subtitle: threats[i].name, type: 'threat' });
            }
          }
        }
        this.sections.set(items);
      } catch {
        this.sections.set([]);
      }
      this.cdr.markForCheck();
      return;
    }

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

    // Scroll to matched text if pending
    if (this.pendingScroll) {
      const { matchText, query } = this.pendingScroll;
      this.pendingScroll = null;
      // Wait for JSON tables to hydrate before searching the DOM
      setTimeout(() => {
        if (!this.scrollToMatchingElement(matchText)) {
          this.scrollToMatchingElement(query);
        }
      }, 600);
    }
  }

  private scrollToMatchingElement(matchText: string): boolean {
    const main = this.el.nativeElement.querySelector('main');
    if (!main) return false;

    const needle = matchText.toLowerCase();
    const candidates = main.querySelectorAll('p, h1, h2, h3, h4, blockquote, li, tr, td') as NodeListOf<HTMLElement>;

    let target: HTMLElement | null = null;
    for (const el of candidates) {
      if (el.textContent?.toLowerCase().includes(needle)) {
        target = el.tagName === 'TD' ? (el.closest('tr') as HTMLElement ?? el) : el;
        break;
      }
    }
    if (!target) return false;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('search-highlight-flash');
    setTimeout(() => target!.classList.remove('search-highlight-flash'), 2500);
    return true;
  }
}
