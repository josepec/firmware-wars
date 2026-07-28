/**
 * Prepara las tablas de markdown para móvil.
 *
 *  1. Resuelve el marcador `.md-cards-next` (directiva `/table-cards`):
 *     marca la tabla siguiente para que en < 640px se pinte como tarjetas.
 *  2. Copia la cabecera de cada columna al `data-label` de sus celdas,
 *     que es lo que la vista de tarjetas usa como etiqueta.
 *
 * Debe ejecutarse DESPUÉS de hydrateJsonTables (las tablas /json no
 * existen en el DOM hasta que ese hidratador las genera).
 */
export function enhanceTables(container: HTMLElement): void {
  for (const marker of Array.from(container.querySelectorAll<HTMLElement>('.md-cards-next'))) {
    const table = findFollowingTable(marker);
    table?.classList.add('md-table-cards');
    marker.remove();
  }

  for (const table of Array.from(container.querySelectorAll('table'))) {
    labelCells(table);
  }
}

/** Primera tabla que aparece tras el marcador, saltando nodos vacíos. */
function findFollowingTable(marker: HTMLElement): HTMLTableElement | null {
  let el = marker.nextElementSibling;
  while (el) {
    if (el.tagName === 'TABLE') return el as HTMLTableElement;
    const nested = el.querySelector('table');
    if (nested) return nested;
    el = el.nextElementSibling;
  }
  return null;
}

function labelCells(table: HTMLTableElement): void {
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() ?? '');
  if (!headers.length) return;

  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    Array.from(row.children).forEach((cell, i) => {
      if (headers[i]) cell.setAttribute('data-label', headers[i]);
    });
  }
}
