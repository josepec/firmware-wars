import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';

interface Tab {
  /** Ruta destino del enlace. */
  path: string;
  icon: string;
  label: string;
  /** Prefijos de URL que marcan esta pestaña como activa. */
  match: string[];
}

const TABS: Tab[] = [
  { path: '/', icon: '⌂', label: 'Inicio', match: ['/'] },
  // ◈ = nibbles, la moneda del army builder: es el símbolo de construir la lista.
  { path: '/army-builder', icon: '◈', label: 'Lista', match: ['/army-builder', '/list'] },
  { path: '/docs', icon: '▤', label: 'Docs', match: ['/docs'] },
  { path: '/mas', icon: '⋯', label: 'Más', match: ['/mas', '/noticias', '/soporte'] },
];

@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
})
export class TabBar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routerSub!: Subscription;

  readonly tabs = TABS;
  readonly url = signal('/');

  /** El panel de admin y las vistas de impresión quedan fuera. */
  readonly visible = signal(true);

  ngOnInit() {
    this.sync(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.sync(e.urlAfterRedirects));
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  isActive(tab: Tab): boolean {
    const url = this.url();
    if (tab.path === '/') return url === '/' || url.startsWith('/#');
    return tab.match.some(m => url === m || url.startsWith(m + '/') || url.startsWith(m + '?'));
  }

  private sync(url: string) {
    const clean = url.split('?')[0];
    this.url.set(clean);
    this.visible.set(!clean.startsWith('/admin') && !clean.includes('-print') && clean !== '/docs/print');
  }
}
