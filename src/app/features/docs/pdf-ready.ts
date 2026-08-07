/**
 * Señal `data-pdf-ready` para el generador de PDF — punto único.
 *
 * Los scripts de publicación esperan a `body[data-pdf-ready]` antes de
 * llamar a `page.pdf()`. Si se marca antes de que las tipografías estén
 * listas, Chrome captura la página maquetada con la fuente de reserva:
 * distinto ancho de glifo, distintos saltos de línea y un PDF que parece
 * "más grande" o "más pequeño" según cómo cayera la carrera de red.
 *
 * Por eso aquí se espera SIEMPRE a las fuentes antes de dar la señal, y
 * se ofrece un hook para recalcular medidas que dependan de ellas
 * (alturas de columna, por ejemplo) ya con las métricas definitivas.
 */

/** Familias que usan las vistas de impresión. */
const PRINT_FAMILIES = ['Share Tech Mono', 'Orbitron', 'Rajdhani', 'JetBrains Mono'];

/** Tope de espera. Muy por debajo del timeout de los scripts (60–120 s). */
const FONT_TIMEOUT_MS = 10_000;

/**
 * Espera a que las tipografías estén cargadas y marca la página como lista.
 *
 * @param remeasure Se ejecuta con las fuentes ya aplicadas, justo antes de
 *                  dar la señal. Úsalo para recalcular medidas dependientes.
 */
export async function signalPdfReady(remeasure?: () => void): Promise<void> {
  await waitForFonts();
  remeasure?.();
  document.body.setAttribute('data-pdf-ready', 'true');
}

/**
 * Nunca lanza ni se cuelga: si las fuentes fallan preferimos seguir y que
 * sea el script de publicación quien aborte con un error explícito, en vez
 * de dejar colgado el proceso.
 */
async function waitForFonts(): Promise<void> {
  if (!document.fonts) return;
  const load = Promise.all([
    ...PRINT_FAMILIES.map(f => document.fonts.load(`1em "${f}"`)),
    ...PRINT_FAMILIES.map(f => document.fonts.load(`bold 1em "${f}"`)),
  ]).then(() => document.fonts.ready);

  const timeout = new Promise<void>(r => setTimeout(r, FONT_TIMEOUT_MS));
  try {
    await Promise.race([load, timeout]);
  } catch {
    /* seguimos: el script de publicación verificará y abortará si falta alguna */
  }
}
