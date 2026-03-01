import type { MarkedExtension, Tokens } from 'marked';
import { highlightBattleScript, isBs } from './bs-highlight';

/* ── Inline-code classification ─────────────────────────────────── */

const KW_SET = new Set([
  'IF-ELSE', 'IF', 'THEN', 'ELSE', 'FOR', 'WHILE', 'AND', 'OR', 'NOT',
]);

function classifyCode(text: string): string {
  const t = text.trim();
  // Lowercase function call: move(), attack(1), getNumbers()
  if (/^[a-z]\w*\(.*\)$/.test(t)) return 'bs-fn';
  // ALL_CAPS or UPPER.DOTTED (phases/structural): INIT(), SETUP, CORE.CYCLE
  const base = t.replace(/\(\)$/, '');
  if (/^[A-Z][A-Z0-9_.]*$/.test(base)) {
    return KW_SET.has(base) ? 'bs-kw' : 'bs-phase';
  }
  // Control-flow keywords: IF, FOR, THEN…
  if (KW_SET.has(t)) return 'bs-kw';
  return '';
}

function safeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── JSON-table directive: /json <path> ────────────────────────── */

const jsonTableExt = {
  name: 'jsonTable',
  level: 'block' as const,

  start(src: string): number | undefined {
    if (src.startsWith('/json ')) return 0;
    const i = src.indexOf('\n/json ');
    return i >= 0 ? i + 1 : undefined;
  },

  tokenizer(src: string): { type: string; raw: string; path: string } | undefined {
    const m = /^\/json[ \t]+(\S+)[ \t]*(?:\n|$)/.exec(src);
    if (m) return { type: 'jsonTable', raw: m[0], path: m[1] };
    return undefined;
  },

  renderer(token: { type: string; raw: string; path: string }): string {
    return `<div class="md-json-table" data-src="assets/data/${token.path}"></div>`;
  },
};

/* ── Column-directive block extension ───────────────────────────── */

const columnDirectiveExt = {
  name: 'columnDirective',
  level: 'block' as const,

  /** Tell marked where this token might start in the remaining source */
  start(src: string): number | undefined {
    if (src.startsWith('/')) return 0;
    const i = src.indexOf('\n/');
    return i >= 0 ? i + 1 : undefined;
  },

  /** Match `/directive-name` on its own line */
  tokenizer(src: string): { type: string; raw: string; directive: string } | undefined {
    const m = /^\/([a-z][a-z-]*)[ \t]*(?:\n|$)/.exec(src);
    if (m) return { type: 'columnDirective', raw: m[0], directive: m[1] };
    return undefined;
  },

  /**
   * Emit HTML for layout directives.
   * Column layout uses CSS column-count: content flows automatically
   * and /col inserts a forced column break.
   */
  renderer(token: { type: string; raw: string; directive: string }): string {
    switch (token.directive) {
      case 'two-columns':
      case 'two-col':
        return '<div class="md-col-2">';
      case 'three-columns':
      case 'three-col':
        return '<div class="md-col-3">';
      case 'col':
      case 'column':
        return '<div class="md-col-break"></div>';
      case 'end-columns':
      case 'end-col':
        return '</div>';
      case 'page':
        return '<div class="md-page-break"></div>';
      case 'space':
        return '<div class="md-space"></div>';
      default:
        return '';
    }
  },
};

/* ── Full extension object ───────────────────────────────────────── */

export const markdownExtensions: MarkedExtension = {
  extensions: [jsonTableExt, columnDirectiveExt],

  renderer: {
    /** BattleScript code blocks (`​`​`bs` or `​`​`battlescript) */
    code(token: Tokens.Code): string | false {
      if (isBs(token.lang)) {
        return `<pre class="bs-pre"><code>${highlightBattleScript(token.text)}</code></pre>`;
      }
      return false; // delegate to default renderer
    },

    /**
     * Inline code: detect keyword / function / phase and apply token class.
     * Returning false delegates unclassified spans to the default renderer.
     */
    codespan(token: Tokens.Codespan): string | false {
      const cls = classifyCode(token.text);
      if (cls) return `<code class="${cls}">${safeHtml(token.text)}</code>`;
      return false;
    },
  },
};
