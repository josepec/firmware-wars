import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QS_NUMS, QS_PHASES, QS_SCRIPT, QS_STEPS } from './quick-start.data';

/** Geometría del tablero hexagonal (SVG). */
const S = 26;
const SQ3 = Math.sqrt(3);
const COLS = 7;
const ROWS = 5;
const OBSTACLES = new Set(['2,1', '4,3', '5,0', '1,4']);
const DOT_COLORS = ['#00ff88', '#38bdf8', '#fde047', '#fb923c', '#f87171'];

const ME_START: [number, number] = [1, 2];
const ME_MOVED: [number, number] = [3, 2];
const FOE_POS: [number, number] = [5, 2];

function center(c: number, r: number): [number, number] {
  return [S * 1.5 * c + 40, S * SQ3 * (r + (c % 2 ? 0.5 : 0)) + 34];
}

function hexPoints(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push((cx + S * Math.cos(a)).toFixed(1) + ',' + (cy + S * Math.sin(a)).toFixed(1));
  }
  return pts.join(' ');
}

interface QsHex {
  key: string;
  points: string;
  obstacle: boolean;
}

interface QsDot {
  cx: number;
  cy: number;
  color: string;
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

  /* ── Tablero ───────────────────────────────────────────── */
  readonly hexes: QsHex[] = [];
  readonly dots: QsDot[] = [];

  readonly foeTransform: string;
  readonly beam: { x1: number; y1: number; x2: number; y2: number };
  readonly dmgPos: { x: number; y: number };

  readonly meTransform = computed(() => {
    const [c, r] = this.step().moved ? ME_MOVED : ME_START;
    const [x, y] = center(c, r);
    return `translate(${x}px, ${y}px)`;
  });

  constructor() {
    let seed = 0;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const key = `${c},${r}`;
        const [cx, cy] = center(c, r);
        this.hexes.push({ key, points: hexPoints(cx, cy), obstacle: OBSTACLES.has(key) });
        if (!OBSTACLES.has(key)) {
          this.dots.push({ cx, cy: cy + S * 0.55, color: DOT_COLORS[(seed++ * 7 + c * 3 + r) % 5] });
        }
      }
    }
    const [fx, fy] = center(...FOE_POS);
    this.foeTransform = `translate(${fx}px, ${fy}px)`;
    const [ax, ay] = center(...ME_MOVED);
    this.beam = { x1: ax + 12, y1: ay - 4, x2: fx - 12, y2: fy - 4 };
    this.dmgPos = { x: fx, y: fy - 24 };
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
