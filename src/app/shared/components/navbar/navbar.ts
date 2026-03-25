import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AppConfig } from '../../../core/services/app-config';

interface DocsCategory {
  id: string;
  label: string;
}

const CATEGORIES: DocsCategory[] = [
  { id: 'reglamento', label: 'REGLAMENTO' },
  { id: 'campaign', label: 'CAMPAÑA' },
  { id: 'escenarios', label: 'ESCENARIOS' },
  { id: 'recursos', label: 'RECURSOS' },
];

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly appConfig = inject(AppConfig);
  private routerSub!: Subscription;
  readonly categories = signal(CATEGORIES.filter(c => c.id === 'reglamento' || c.id === 'recursos'));
  readonly docsMenuOpen = signal(false);

  isHomeActive(): boolean {
    return this.router.url === '/';
  }

  isDocsActive(): boolean {
    return this.router.url.startsWith('/docs');
  }

  isListActive(): boolean {
    return this.router.url.startsWith('/army-builder');
  }

  toggleDocsMenu() {
    this.docsMenuOpen.update(v => !v);
  }

  async ngOnInit() {
    const visible: DocsCategory[] = [];
    for (const c of CATEGORIES) {
      if (await this.appConfig.isCategoryVisible(c.id)) visible.push(c);
    }
    this.categories.set(visible);

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.docsMenuOpen.set(false));
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (this.docsMenuOpen() && !(e.target as HTMLElement).closest('.docs-dropdown')) {
      this.docsMenuOpen.set(false);
    }
  }
}
