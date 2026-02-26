/**
 * BattleScript syntax highlighter
 * Token color palette matches the landing page's BATTLESCRIPT_EXAMPLE.BS
 *
 * Token classes:
 *  .bs-kw    — control-flow keywords (IF, THEN, ELSE, FOR, WHILE…)  → yellow-300
 *  .bs-op    — operators (==, !=, >=, <=, >, <)                     → pink-400
 *  .bs-num   — numeric literals                                      → orange-300
 *  .bs-var   — property access (enemy.distance, self.energy)         → cyan-300
 *  .bs-fn    — function calls (move(), attack())                     → green-300
 *  .bs-type  — PascalCase type/ability names (RocketPunch)           → violet-300
 *  .bs-phase — structural keywords (START, END, INIT, SETUP)         → green-500/50
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Groups (in priority order):
 * 1: kw    — IF-ELSE must come before IF to avoid partial match
 * 2: op
 * 3: num
 * 4: var   — a.b (property.path)
 * 5: fn    — word()
 * 6: phase — START / END / INIT / SETUP with optional ()
 * 7: type  — PascalCase
 */
const LINE_RE =
  /(IF-ELSE|\b(?:IF|THEN|ELSE|FOR|WHILE|AND|OR|NOT)\b)|(==|!=|>=|<=|[<>])|(\b\d+\b)|([a-z]\w*\.[a-z]\w*)|([a-z]\w*\(\))|(\b(?:START|END|INIT|SETUP)(?:\(\))?)|([A-Z][a-z]\w*)/;

function highlightLine(line: string): string {
  // Create a fresh regex instance each call (g flag requires fresh lastIndex)
  const re = new RegExp(LINE_RE.source, 'g');
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    out += esc(line.slice(last, m.index));
    const [full, kw, op, num, variable, fn, phase, type_] = m;

    if      (kw)       out += `<span class="bs-kw">${esc(full)}</span>`;
    else if (op)       out += `<span class="bs-op">${esc(full)}</span>`;
    else if (num)      out += `<span class="bs-num">${esc(full)}</span>`;
    else if (variable) out += `<span class="bs-var">${esc(full)}</span>`;
    else if (fn)       out += `<span class="bs-fn">${esc(full)}</span>`;
    else if (phase)    out += `<span class="bs-phase">${esc(full)}</span>`;
    else if (type_)    out += `<span class="bs-type">${esc(full)}</span>`;
    else               out += esc(full);

    last = m.index + full.length;
  }

  out += esc(line.slice(last));
  return out;
}

export function highlightBattleScript(code: string): string {
  return code.split('\n').map(highlightLine).join('\n');
}

export function isBs(lang: string | undefined | null): boolean {
  return lang === 'bs' || lang === 'battlescript';
}
