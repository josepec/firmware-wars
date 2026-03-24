import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';

interface DocsCategory {
  id: string;
  label: string;
  hidden?: boolean;
}

const CATEGORIES: DocsCategory[] = [
  { id: 'reglamento', label: 'REGLAMENTO' },
  { id: 'recursos', label: 'RECURSOS' },
  { id: 'escenarios', label: 'ESCENARIOS', hidden: false },
];

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routerSub!: Subscription;
  readonly categories = CATEGORIES.filter(c => !c.hidden);
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

  ngOnInit() {
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
