/**
 * Modelo de las cartas imprimibles.
 *
 * Una carta no guarda datos propios: rango, daño, energía y coste salen de
 * `tables/attack-functions.json`, igual que en el Army Builder. `cards.json`
 * solo aporta lo que la tabla no puede dar — el texto corto que cabe en la
 * carta y la etiqueta ESTADO de las funciones sin daño.
 */

import type { AttackFunction } from '../../../core/services/data';

export type CardType = 'ATAQUE' | 'COMMON';
export type CardVersion = 'V1' | 'V2' | 'V3' | 'COMMON';

/** Colores de la hoja de diseño (export-cartas). */
export const ACCENT: Record<CardVersion, string> = {
  V1: '#f2a93b',
  V2: '#b79cff',
  V3: '#6fd8e6',
  COMMON: '#8fd98a',
};

/** Términos de rango; el resto de entradas del glosario son estados. */
const RANGE_TERMS = new Set(['LR', 'SLDV', 'R(n)']);

export interface CardStat {
  label: string;
  /** El daño puede ser `—`: la banda de datos es siempre RANGO + DAÑO. */
  value: string;
  /** Sufijo del valor: `LR`, `SLDV`, `R(2)`… Vacío si no aplica. */
  tag: string;
}

export interface GlossaryEntry {
  term: string;
  text: string;
  kind: 'range' | 'status';
}

export interface GameCard {
  /** Id del arte → `assets/img/cards/<id>.png`. */
  id: string;
  version: CardVersion;
  accent: string;
  name: string;
  /** Energía (⚡). */
  cost: string;
  type: CardType;
  /** Nibbles (◈). Vacío en las COMMON: no cuestan presupuesto. */
  value: string;
  stats: CardStat[];
  text: string;
  glossary: GlossaryEntry[];
}

/* ── Metadatos (cards.json) ──────────────────────────────────── */

export interface CardOverride {
  art?: string;
  text?: string;
}

export interface CommonCardMeta {
  art: string;
  name: string;
  cost: string;
  value: string;
  stats: { label: string; value: string }[];
  text: string;
}

export interface CardsMeta {
  glossary: Record<string, string>;
  common: CommonCardMeta[];
  functions: Record<string, CardOverride>;
}

/* ── Derivaciones ────────────────────────────────────────────── */

/** `powerSmash()` → `power-smash`, el nombre del PNG del arte. */
export function artId(fnName: string): string {
  return fnName
    .replace(/\(.*\)$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Separa `"2-8 (LR)"` en valor y etiqueta. Un rango `—` es una función que
 * actúa sobre el propio Bot: eso es rango 0, y el texto de la carta lo dice.
 */
export function splitRange(range: string): { value: string; tag: string } {
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(range.trim());
  const value = (m ? m[1] : range).trim();
  return {
    value: value === '' || value === '—' ? '0' : value,
    tag: m ? m[2].trim() : '',
  };
}

/** `R(2)` y `R(1)` comparten la entrada `R(n)` del glosario. */
function glossaryKey(tag: string): string {
  return /^R\(\d+\)$/.test(tag) ? 'R(n)' : tag;
}

/**
 * Términos a explicar en la carta: el tipo de rango y los estados citados,
 * vengan del texto entre backticks o de la propia banda de datos.
 */
export function collectGlossary(
  meta: CardsMeta,
  rangeTag: string,
  sources: string[],
): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();

  const push = (term: string, kind: 'range' | 'status') => {
    const text = meta.glossary[term];
    if (!text || seen.has(term)) return;
    seen.add(term);
    out.push({ term, text, kind });
  };

  if (rangeTag) push(glossaryKey(rangeTag), 'range');

  for (const src of sources) {
    for (const m of src.matchAll(/[A-Z][A-Z_]{2,}/g)) {
      if (!RANGE_TERMS.has(m[0])) push(m[0], 'status');
    }
  }
  return out;
}

/**
 * Carta de una función de ataque. La banda de datos es siempre RANGO + DAÑO
 * — un daño `—` se deja como tal y es el texto quien cuenta el efecto (el
 * estado que aplica, la Barrera que crea…), no una tercera columna.
 */
export function buildAttackCard(fn: AttackFunction, meta: CardsMeta): GameCard {
  const ov = meta.functions[fn.name] ?? {};
  const range = splitRange(fn.range);
  const text = (ov.text ?? fn.effects).trim();
  const version = `V${fn.version}` as CardVersion;

  return {
    id: ov.art ?? artId(fn.name),
    version,
    accent: ACCENT[version] ?? ACCENT.COMMON,
    name: fn.name,
    cost: fn.energy,
    type: 'ATAQUE',
    value: String(fn.cost),
    stats: [
      { label: 'RANGO', value: range.value, tag: range.tag },
      { label: 'DAÑO', value: fn.damage || '—', tag: '' },
    ],
    text,
    glossary: collectGlossary(meta, range.tag, [text]),
  };
}

/** Carta común (`move`, `shield`): sus datos viven enteros en `cards.json`. */
export function buildCommonCard(c: CommonCardMeta, meta: CardsMeta): GameCard {
  return {
    id: c.art,
    version: 'COMMON',
    accent: ACCENT.COMMON,
    name: c.name,
    cost: c.cost,
    type: 'COMMON',
    value: c.value,
    stats: c.stats.map(s => ({ ...s, tag: '' })),
    text: c.text,
    glossary: collectGlossary(meta, '', [c.text]),
  };
}
