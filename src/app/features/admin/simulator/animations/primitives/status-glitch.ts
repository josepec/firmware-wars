/** J — horizontal scan-line overlay that oscillates and decays */
export type GlitchKind = 'LAG' | 'BUG' | 'DMZ' | 'ERASE';

const GLITCH_COLORS: Record<GlitchKind, string> = {
  LAG: '#94a3b8',
  BUG: '#22c55e',
  DMZ: '#0ea5e9',
  ERASE: '#64748b',
};

export function statusGlitch(
  g: SVGGElement, cx: number, cy: number,
  kind: GlitchKind, size: number,
): Promise<void> {
  const color = GLITCH_COLORS[kind];
  const nLines = 4;
  const els: SVGLineElement[] = [];

  for (let i = 0; i < nLines; i++) {
    const y = cy - size * 0.38 + (i / (nLines - 1)) * size * 0.76;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(cx - size * 0.42));
    el.setAttribute('y1', String(y));
    el.setAttribute('x2', String(cx + size * 0.42));
    el.setAttribute('y2', String(y));
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', '1.2');
    el.setAttribute('pointer-events', 'none');
    g.appendChild(el);
    els.push(el);
  }

  return new Promise(resolve => {
    const duration = 550;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const decay = 1 - t;
      els.forEach((el, i) => {
        const phase = (now / 55 + i * 1.3) * Math.PI;
        const shake = Math.sin(phase) * size * 0.15 * decay;
        el.setAttribute('transform', `translate(${shake}, 0)`);
        el.setAttribute('opacity', String(decay * 0.85));
      });
      if (t < 1) requestAnimationFrame(tick);
      else { els.forEach(e => e.remove()); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
