import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AppConfig } from './app-config';

const SITE_URL = 'https://firmwarewars.josepec.eu';
const SITE_NAME = 'Firmware Wars';

/**
 * Título por ruta de impresión. Reutiliza el mismo nombre que los scripts de
 * publicación pasan como `subtitle` a la portada, para que el PDF descargado
 * se llame igual que lo que se lee en su cubierta.
 */
const PRINT_TITLES: Record<string, string> = {
  'docs/print': 'Manual del Juego',
  'docs/campaign-print': 'Campaña',
  'docs/scenarios-print': 'Escenarios y Amenazas',
  'docs/cover-print': 'Portada',
};

/**
 * La hoja de cartas es la única vista de impresión cuyo título depende de la
 * URL: con `fns` es la lista de un jugador, sin él el catálogo completo. Son
 * nombres cerrados, sin el prefijo del sitio — es el nombre de archivo que
 * propone Chrome al guardar como PDF. Ver `docs/cards/cards-print.ts`.
 */
const CARDS_PATH = '/docs/cards-print';
const CARDS_LIST_TITLE = 'Firmware Wars - Cartas';
const CARDS_CATALOG_TITLE = 'Firmware Wars - Cartas Completas';

const HOME_TITLE = 'Firmware Wars — Wargame de robots y programación · Print & Play';
const HOME_DESC =
  'Wargame de mesa de ciencia ficción donde programas robots de combate: escribe tu BattleScript, ' +
  'compila tu estrategia y destruye al Bot rival en un tablero de hexágonos. Reglamento online y print & play gratis.';

/** Metadatos por categoría de docs. */
const DOCS_META: Record<string, { label: string; desc: string; configUrl?: string }> = {
  reglamento: {
    label: 'Reglamento',
    desc: 'Reglamento completo de Firmware Wars: preparación, ciclo de turno (INIT, BOOT, COMPILE, RUN, DEBUG, END), operaciones, funciones de ataque y tablas de referencia.',
    configUrl: '/assets/config/docs.config.json',
  },
  recursos: {
    label: 'Recursos',
    desc: 'Recursos y descargas de Firmware Wars: tablas de equivalencia de dados, terminal de juego y material print & play.',
    configUrl: '/assets/config/recursos.config.json',
  },
  campaign: {
    label: 'Campaña',
    desc: 'Modo campaña de Firmware Wars: progresión de Bots, experiencia, Nibbles, corporaciones y finales.',
    configUrl: '/assets/config/campaign.config.json',
  },
  escenarios: {
    label: 'Escenarios',
    desc: 'Escenarios y amenazas de Firmware Wars: misiones con objetivos, despliegues y reglas especiales.',
  },
};

interface DocsSection {
  id: string;
  title?: string;
  subtitle?: string;
}

/**
 * SEO por ruta para una SPA sin SSR: título, description, canonical y robots.
 * Google/Bing renderizan JS, así que estos metadatos sí se indexan.
 * - /admin, vistas print y /list → noindex.
 * - Categorías de docs ocultas en app.config.json → noindex automático
 *   (al publicarlas solo queda actualizar robots.txt y sitemap.xml).
 */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly appConfig = inject(AppConfig);

  /** Cache de secciones por categoría (para títulos de subpáginas). */
  private sectionsCache = new Map<string, Promise<DocsSection[]>>();

  init(): void {
    this.apply(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.apply(e.urlAfterRedirects));
  }

  private async apply(rawUrl: string): Promise<void> {
    const path = rawUrl.split('?')[0].split('#')[0] || '/';

    if (path.startsWith('/admin')) {
      this.set({ title: `Admin · ${SITE_NAME}`, desc: '', index: false, path });
      return;
    }
    if (path.startsWith('/list/')) {
      this.set({ title: SITE_NAME, desc: HOME_DESC, index: false, path });
      return;
    }
    if (path === CARDS_PATH) {
      const esLista = /[?&]fns=[^&]/.test(rawUrl);
      this.set({
        title: esLista ? CARDS_LIST_TITLE : CARDS_CATALOG_TITLE,
        desc: '',
        index: false,
        path,
      });
      return;
    }
    // Chrome copia document.title a los metadatos del PDF que genera, así que
    // este título es el que acaba viendo quien abre el manual descargado.
    const printTitle = PRINT_TITLES[path.replace(/^\//, '')];
    if (printTitle !== undefined) {
      this.set({ title: `${SITE_NAME} — ${printTitle}`, desc: '', index: false, path });
      return;
    }
    if (path.startsWith('/docs')) {
      await this.applyDocs(path);
      return;
    }
    if (path.startsWith('/army-builder')) {
      this.set({
        title: `Crea tu Bot — Constructor de listas · ${SITE_NAME}`,
        desc: 'Configura tus robots de combate para Firmware Wars: elige modelo, reparte puntos de mejora y carga funciones de ataque con tu presupuesto de Nibbles. Exporta e imprime tu lista.',
        index: true,
        path,
      });
      return;
    }
    // Home y fallback
    this.set({ title: HOME_TITLE, desc: HOME_DESC, index: true, path: '/' });
  }

  private async applyDocs(path: string): Promise<void> {
    const parts = path.replace(/^\/docs\/?/, '').split('/').filter(Boolean);
    const catId = parts[0] || 'reglamento';
    const sectionId = parts[1] || null;
    const cat = DOCS_META[catId];

    if (!cat) {
      this.set({ title: `Docs · ${SITE_NAME}`, desc: HOME_DESC, index: false, path });
      return;
    }

    const visible = await this.appConfig.isCategoryVisible(catId);
    let title = `${cat.label} · ${SITE_NAME} — Juego de mesa de programación`;

    if (sectionId && cat.configUrl) {
      const sections = await this.loadSections(catId, cat.configUrl);
      const sec = sections.find(s => s.id === sectionId);
      if (sec?.subtitle) title = `${sec.subtitle} — ${cat.label} · ${SITE_NAME}`;
    }

    this.set({ title, desc: cat.desc, index: visible, path });
  }

  private loadSections(catId: string, url: string): Promise<DocsSection[]> {
    if (!this.sectionsCache.has(catId)) {
      this.sectionsCache.set(
        catId,
        fetch(url)
          .then(r => (r.ok ? r.json() : { sections: [] }))
          .then((cfg: { sections?: DocsSection[] }) => cfg.sections ?? [])
          .catch(() => []),
      );
    }
    return this.sectionsCache.get(catId)!;
  }

  private set(cfg: { title: string; desc: string; index: boolean; path: string }): void {
    this.title.setTitle(cfg.title);

    if (cfg.desc) {
      this.meta.updateTag({ name: 'description', content: cfg.desc });
      this.meta.updateTag({ property: 'og:description', content: cfg.desc });
    }
    this.meta.updateTag({ name: 'robots', content: cfg.index ? 'index, follow' : 'noindex, nofollow' });
    this.meta.updateTag({ property: 'og:title', content: cfg.title });
    this.meta.updateTag({ property: 'og:url', content: SITE_URL + cfg.path });

    let canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.doc.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(canonical);
    }
    canonical.setAttribute('href', SITE_URL + cfg.path);
  }
}
