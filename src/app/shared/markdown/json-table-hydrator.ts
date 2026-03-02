/**
 * Busca elementos .md-json-table dentro de un contenedor,
 * carga el JSON (ruta en el textContent del div) y renderiza una tabla HTML.
 *
 * Los valores de celda soportan markdown inline básico (`code`).
 */
export async function hydrateJsonTables(container: HTMLElement): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>('.md-json-table');
  if (!placeholders.length) return;

  await Promise.all(Array.from(placeholders).map(async (el) => {
    const src = el.textContent?.trim();
    if (!src) return;

    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const rows: Record<string, string>[] = await resp.json();
      if (!rows.length) return;

      const columns = Object.keys(rows[0]);

      const thead = columns.map(c => `<th>${esc(c)}</th>`).join('');
      const tbody = rows.map(row =>
        '<tr>' + columns.map(col =>
          `<td>${inlineMd(row[col] ?? '')}</td>`
        ).join('') + '</tr>'
      ).join('');

      el.outerHTML = `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    } catch (e) {
      console.error(`[json-table] Error loading ${src}:`, e);
    }
  }));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convierte `code` en <code> con clasificación BattleScript básica */
function inlineMd(s: string): string {
  return esc(s).replace(/`([^`]+)`/g, (_, code: string) => {
    const cls = classifyInline(code);
    return cls ? `<code class="${cls}">${code}</code>` : `<code>${code}</code>`;
  });
}

const KW = new Set(['IF-ELSE', 'IF', 'THEN', 'ELSE', 'FOR', 'WHILE', 'AND', 'OR', 'NOT', 'TRY-CATCH']);

function classifyInline(text: string): string {
  const t = text.trim();
  if (/^[a-z]\w*\(.*\)$/.test(t)) return 'bs-fn';
  const base = t.replace(/\(\)$/, '');
  if (/^[A-Z][A-Z0-9_.]*$/.test(base)) return KW.has(base) ? 'bs-kw' : 'bs-phase';
  if (KW.has(t)) return 'bs-kw';
  return '';
}
