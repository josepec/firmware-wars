import { ChangeDetectorRef, Component, ElementRef, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DataService } from '../../../core/services/data';
import { classifyCode } from '../../../shared/markdown/marked-extensions';
import { signalPdfReady } from '../pdf-ready';
import { GameCard, buildAttackCard, buildCommonCard } from './card-model';

/** Rejilla de la hoja: 4 × 4 cartas Mini USA por cara. */
const PER_SHEET = 16;
const COLS = 4;

/** Suelo del autoajuste: por debajo el texto deja de ser legible impreso. */
const MIN_TEXT_SCALE = 0.72;
const MIN_STAT_SCALE = 0.55;

/* El título del documento — que es el nombre de archivo que propone Chrome al
   guardar como PDF, y el título del PDF generado — lo pone `core/services/seo`
   a partir de la misma `fns` que se lee aquí: «Firmware Wars - Cartas» para una
   lista, «… Cartas Completas» para el catálogo. Si cambia el criterio de
   `isList`, hay que cambiarlo allí también. */

interface Sheet {
  index: number;
  /** Caras, en orden de lectura. `null` = hueco de la última hoja. */
  fronts: (GameCard | null)[];
  /** Dorsos, reflejados por filas para casar en impresión a doble cara. */
  backs: (GameCard | null)[];
}

interface Tick {
  left: string;
  top: string;
  w: string;
  h: string;
}

@Component({
  selector: 'app-cards-print',
  templateUrl: './cards-print.html',
  styleUrl: './cards-print.scss',
})
export class CardsPrint {
  readonly sheets = signal<Sheet[]>([]);
  readonly ticks = buildTicks();
  readonly pins = Array.from({ length: 8 }, (_, i) => i);

  private readonly params = new URLSearchParams(window.location.search);
  readonly showMarks = this.params.get('marks') !== '0';
  readonly showSafeArea = this.params.get('safe') === '1';

  /** Copias de cada carta: 3, las Operaciones que caben en un turno. */
  private readonly copies = clampCopies(this.params.get('copies'));
  /**
   * Funciones pedidas, un grupo por Bot separado por `;`
   * (`?fns=laserBeam,railgun;plasmaBolt,ionCannon`). Vacío = catálogo con
   * todas. Un mismo nombre puede repetirse: dos Bots con la misma función
   * necesitan dos juegos de cartas.
   */
  private readonly groups = (this.params.get('fns') ?? '')
    .split(';')
    .map(g => g.split(',').map(s => s.trim().replace(/\(\)$/, '')).filter(Boolean))
    .filter(g => g.length > 0);

  /** Lista de un jugador frente a catálogo completo: cambian título y cortes. */
  private readonly isList = this.groups.length > 0;

  private readonly data = inject(DataService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    forkJoin({
      attacks: this.data.getAttackFunctions(),
      meta: this.data.getCardsMeta(),
    }).subscribe(({ attacks, meta }) => {
      const byName = new Map(attacks.map(f => [f.name.replace(/\(\)$/, ''), f]));

      /* Un bloque por Bot, y las comunes en el suyo. En el catálogo hay un
         único bloque de ataque, así que las comunes lo siguen sin cortar. */
      const blocks: GameCard[][] = this.isList
        ? this.groups.map(g =>
            repeat(g.map(n => byName.get(n)).filter(f => !!f).map(f => buildAttackCard(f, meta)), this.copies),
          )
        : [repeat(attacks.map(f => buildAttackCard(f, meta)), this.copies)];

      /* Cada Bot necesita sus propias comunes: se multiplican por bloque. */
      const commonCopies = this.copies * blocks.length;
      blocks.push(repeat(meta.common.map(c => buildCommonCard(c, meta)), commonCopies));

      this.sheets.set(paginate(blocks, this.isList));
      /* Render síncrono: `fitTexts` mide cajas reales, y sin esto llegaría
         a un DOM todavía vacío. */
      this.cdr.detectChanges();
      signalPdfReady(() => this.fitTexts());
    });
  }

  /**
   * La caja de texto es fija por diseño (15,4 mm). Cuando el efecto más el
   * glosario no caben, lo que cede es el cuerpo de letra — nunca la caja, y
   * nunca recortando texto. Se ejecuta con las tipografías ya cargadas: las
   * métricas de una fuente de reserva darían un ajuste equivocado.
   */
  private fitTexts(): void {
    const boxes = this.el.nativeElement.querySelectorAll<HTMLElement>('.text');
    for (const box of Array.from(boxes)) {
      let scale = 1;
      while (box.scrollHeight > box.clientHeight + 0.5 && scale > MIN_TEXT_SCALE) {
        scale -= 0.04;
        box.style.setProperty('--text-scale', scale.toFixed(2));
      }
    }
    this.fitStats();
  }

  /**
   * Un valor largo (`+1d4 VIDA`, `SAFE_MODE`) no cabe a 11 pt y desbordaría
   * la carta. La banda de datos no se puede ensanchar: se encoge el valor.
   */
  private fitStats(): void {
    const values = this.el.nativeElement.querySelectorAll<HTMLElement>('.stat-value');
    for (const v of Array.from(values)) {
      let scale = 1;
      while (v.scrollWidth > v.clientWidth + 0.5 && scale > MIN_STAT_SCALE) {
        scale -= 0.05;
        v.style.setProperty('--stat-scale', scale.toFixed(2));
      }
    }
  }

  print(): void {
    window.print();
  }

  /** Total de cartas, para el pie de hoja. */
  totalCards(): number {
    return this.sheets().reduce(
      (n, s) => n + s.fronts.filter(c => !!c).length,
      0,
    );
  }

  artUrl(card: GameCard): string {
    return `/assets/img/cards/${card.id}.png`;
  }

  /**
   * Mientras falte el PNG del arte, el hueco enseña el marcador «ARTE» en vez
   * del icono de imagen rota del navegador — que sí se imprimiría.
   */
  hideArt(e: Event): void {
    (e.target as HTMLElement).style.display = 'none';
  }

  /** Muestra `2-8 LR` en una sola línea de la banda de datos. */
  statText(stat: { value: string; tag: string }): string {
    return stat.tag ? `${stat.value} ${stat.tag}` : stat.value;
  }

  /**
   * Texto de efectos con los términos entre backticks coloreados: los
   * estados y `BUG` salen en rojo, igual que en el reglamento y el hover
   * del Army Builder.
   */
  renderText(text: string): string {
    const cached = this.textCache.get(text);
    if (cached) return cached;
    const html = escapeHtml(text).replace(/`([^`]+)`/g, (_, code: string) => {
      const cls = classifyCode(code);
      return cls ? `<code class="${cls}">${code}</code>` : `<code>${code}</code>`;
    });
    this.textCache.set(text, html);
    return html;
  }

  private textCache = new Map<string, string>();
}

/* ── Helpers ─────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clampCopies(raw: string | null): number {
  const n = parseInt(raw ?? '1', 10);
  return Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : 1;
}

/** Copias contiguas: las 3 de una carta caen juntas al recortar. */
function repeat(cards: GameCard[], copies: number): GameCard[] {
  if (copies <= 1) return cards;
  return cards.flatMap(c => Array.from({ length: copies }, () => c));
}

/**
 * Reparte los bloques en hojas. Con `breakBlocks`, cada bloque empieza hoja
 * nueva: en una lista, las cartas de un Bot no se mezclan con las de otro ni
 * con las comunes, aunque sobre sitio. El catálogo no corta — sería tirar
 * papel para separar lo que ya va ordenado.
 */
function paginate(blocks: GameCard[][], breakBlocks: boolean): Sheet[] {
  const sheets: Sheet[] = [];
  const chunks = breakBlocks ? blocks : [blocks.flat()];

  for (const cards of chunks) {
    for (let i = 0; i < cards.length; i += PER_SHEET) {
      const fronts: (GameCard | null)[] = cards.slice(i, i + PER_SHEET);
      while (fronts.length < PER_SHEET) fronts.push(null);
      sheets.push({ index: sheets.length, fronts, backs: mirrorRows(fronts) });
    }
  }
  return sheets;
}

/**
 * Al imprimir a doble cara por el borde largo la hoja se voltea sobre el eje
 * vertical: cada fila queda invertida. Reflejarla aquí hace que cada dorso
 * caiga sobre su propia carta.
 */
function mirrorRows(cards: (GameCard | null)[]): (GameCard | null)[] {
  const out: (GameCard | null)[] = [];
  for (let i = 0; i < cards.length; i += COLS) {
    out.push(...cards.slice(i, i + COLS).reverse());
  }
  return out;
}

/** Marcas de corte en los márgenes, fuera de la zona impresa de la carta. */
function buildTicks(): Tick[] {
  const L = 23, T = 28, COL = 41, ROW = 63, ROWS = 4, LEN = 4, W = '0.2mm';
  const right = L + COL * COLS;
  const bottom = T + ROW * ROWS;
  const ticks: Tick[] = [];
  for (let i = 0; i <= COLS; i++) {
    const x = L + i * COL;
    ticks.push({ left: `${x}mm`, top: `${T - LEN}mm`, w: W, h: `${LEN}mm` });
    ticks.push({ left: `${x}mm`, top: `${bottom}mm`, w: W, h: `${LEN}mm` });
  }
  for (let j = 0; j <= ROWS; j++) {
    const y = T + j * ROW;
    ticks.push({ left: `${L - LEN}mm`, top: `${y}mm`, w: `${LEN}mm`, h: W });
    ticks.push({ left: `${right}mm`, top: `${y}mm`, w: `${LEN}mm`, h: W });
  }
  return ticks;
}
