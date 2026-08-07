import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DataService } from '../../../core/services/data';
import { signalPdfReady } from '../pdf-ready';

/** La hoja tiene sitio para seis filas de estados, a 5 fichas por fila. */
const STATE_ROWS = 6;

/** Colores y símbolo de reserva para un estado sin entrada en `tokens.json`. */
const FALLBACK = { glyph: '◆', color: '#8fd98a' };

export interface TokenStateMeta {
  glyph: string;
  color: string;
  label: string;
}

export interface TokensMeta {
  copiesPerState: number;
  states: Record<string, TokenStateMeta>;
  coin: {
    copies: number;
    ready: { glyph: string; title: string; label: string; note: string };
    used: { glyph: string; title: string; label: string };
  };
  notes: { states: string; coin: string };
}

interface StateToken {
  id: string;
  glyph: string;
  color: string;
  label: string;
}

@Component({
  selector: 'app-tokens-print',
  templateUrl: './tokens-print.html',
  styleUrl: './tokens-print.scss',
})
export class TokensPrint {
  readonly tokens = signal<StateToken[]>([]);
  readonly coins = signal<number[]>([]);
  readonly meta = signal<TokensMeta | null>(null);

  private readonly params = new URLSearchParams(window.location.search);
  /** Copias por estado. Cinco es el máximo que cabe en la hoja. */
  private readonly copies = clampCopies(this.params.get('copies'));

  private readonly data = inject(DataService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    forkJoin({
      states: this.data.getStatusEffects(),
      meta: this.data.getTokensMeta(),
    }).subscribe(({ states, meta }) => {
      this.meta.set(meta);
      const perState = this.copies ?? meta.copiesPerState;

      /* El orden lo manda `tokens.json` — es el de la hoja de diseño, por
         familia de color. Un estado que solo esté en status-effects.json se
         añade al final con símbolo y color de reserva, para que no se quede
         fuera de la hoja sin que nadie se entere. */
      const orden = [
        ...Object.keys(meta.states),
        ...states.map(s => s.name).filter(n => !(n in meta.states)),
      ].slice(0, STATE_ROWS);

      const tokens: StateToken[] = [];
      for (const id of orden) {
        const m = meta.states[id]
          ?? { ...FALLBACK, label: states.find(s => s.name === id)?.description ?? '' };
        for (let i = 0; i < perState; i++) {
          tokens.push({ id, glyph: m.glyph, color: m.color, label: m.label });
        }
      }

      this.tokens.set(tokens);
      this.coins.set(Array.from({ length: meta.coin.copies }, (_, i) => i));
      this.cdr.detectChanges();
      signalPdfReady();
    });
  }

  print(): void {
    window.print();
  }
}

function clampCopies(raw: string | null): number | null {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
}
