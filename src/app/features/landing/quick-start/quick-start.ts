import { Component, ElementRef, computed, effect, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QS_NUMS, QS_PHASES, QS_SCRIPT, QS_STEPS } from './quick-start.data';

/** Geometría del tablero hexagonal (SVG) — valores del prototipo validado:
    hexágonos de vértice arriba, filas desplazadas, rejilla 7×4. */
const DRAW_R = 32;                        // radio de dibujo del hexágono
const STEP_R = 34;                        // radio de reparto (deja aire entre hexes)
const HEX_W = Math.sqrt(3) * STEP_R;      // ancho de una fila
const COLS = 7;
const ROWS = 4;
const OBSTACLES = new Set(['3,1', '1,3', '5,3', '4,0']);

const ME_START: [number, number] = [1, 2];
const ME_MOVED: [number, number] = [3, 2];
const FOE_POS: [number, number] = [5, 2];

function center(col: number, row: number): [number, number] {
  return [42 + col * HEX_W + (row % 2) * (HEX_W / 2), 44 + row * (STEP_R * 1.5)];
}

function hexPoints(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push((cx + DRAW_R * Math.cos(a)).toFixed(1) + ',' + (cy + DRAW_R * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
}

interface QsHex {
  key: string;
  points: string;
  obstacle: boolean;
}

@Component({
  selector: 'app-quick-start',
  imports: [RouterLink],
  templateUrl: './quick-start.html',
  styleUrl: './quick-start.scss',
})
export class QuickStart {
  readonly phases = QS_PHASES;
  readonly steps = QS_STEPS;
  readonly nums = QS_NUMS;
  readonly scriptLines = QS_SCRIPT;

  readonly cur = signal(0);
  readonly step = computed(() => this.steps[this.cur()]);
  readonly isLast = computed(() => this.cur() === this.steps.length - 1);

  /** Carril del pipeline: se auto-centra en la fase activa al cambiar de paso. */
  private readonly pipeline = viewChild<ElementRef<HTMLElement>>('pipeline');

  /* ── Tablero ───────────────────────────────────────────── */
  readonly hexes: QsHex[] = [];

  readonly foeTransform: string;
  readonly beam: { x1: number; y1: number; x2: number; y2: number };
  readonly dmgPos: { x: number; y: number };

  readonly meTransform = computed(() => {
    const [c, r] = this.step().moved ? ME_MOVED : ME_START;
    const [x, y] = center(c, r);
    return `translate(${x}px, ${y}px)`;
  });

  constructor() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const key = `${col},${row}`;
        const [cx, cy] = center(col, row);
        this.hexes.push({ key, points: hexPoints(cx, cy), obstacle: OBSTACLES.has(key) });
      }
    }
    const [fx, fy] = center(...FOE_POS);
    this.foeTransform = `translate(${fx}px, ${fy}px)`;
    const [ax, ay] = center(...ME_MOVED);
    this.beam = { x1: ax + 18, y1: ay - 6, x2: fx - 18, y2: fy - 6 };
    this.dmgPos = { x: fx, y: fy - 34 };

    effect(() => {
      const phase = this.step().phase;
      const lane = this.pipeline()?.nativeElement;
      if (lane) this.centerPhase(lane, phase);
    });
  }

  /**
   * Centra el chip de la fase activa dentro del carril.
   * Se calcula a mano (en vez de `scrollIntoView`) para no arrastrar
   * el scroll vertical de la página al desplazar el carril.
   */
  private centerPhase(lane: HTMLElement, phase: number): void {
    const chip = lane.querySelector<HTMLElement>(`.ph[data-phase="${phase}"]`);
    if (!chip || lane.scrollWidth <= lane.clientWidth) return;
    const left = chip.offsetLeft - (lane.clientWidth - chip.offsetWidth) / 2;
    lane.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }

  /* ── Navegación ────────────────────────────────────────── */
  go(i: number) {
    this.cur.set(Math.max(0, Math.min(this.steps.length - 1, i)));
  }

  prev() {
    this.go(this.cur() - 1);
  }

  next() {
    this.go(this.isLast() ? 0 : this.cur() + 1);
  }

  /* ── Helpers de plantilla ──────────────────────────────── */
  numState(i: number): 'hidden' | 'idle' | 'used' | 'spent' {
    const st = this.step();
    if (!st.showNums) return 'hidden';
    if (st.num === i) return 'used';
    if (st.spent.includes(i)) return 'spent';
    return 'idle';
  }

  scriptClass(i: number): string {
    const sc = this.step().script;
    if (!sc) return '';
    if (sc.hot.includes(i)) return 'hot';
    if (sc.done.includes(i)) return 'done';
    return '';
  }

  phaseState(i: number): 'on' | 'skip' | 'off' {
    const st = this.step();
    if (st.phase === i) return 'on';
    if (st.end && this.phases[i] === 'DEBUG()') return 'skip';
    return 'off';
  }

  isPath(key: string): boolean {
    return this.step().path?.includes(key) ?? false;
  }

  isHit(key: string): boolean {
    return this.step().hit?.includes(key) ?? false;
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.cur() + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
  }
}
