/** K — text that rises and fades over the target hex */
export function floatingText(
  g: SVGGElement, x: number, y: number,
  text: string, color: string, size: number,
): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('font-size', String(Math.round(size * 0.4)));
  el.setAttribute('font-weight', '700');
  el.setAttribute('font-family', "'Orbitron', monospace");
  el.setAttribute('fill', color);
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);

  return new Promise(resolve => {
    const startY = y - size * 0.75;
    const rise = size * 1.1;
    const duration = 900;
    const start = performance.now();

    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 3;
      const opacity = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
      const zigzag = Math.sin(t * Math.PI * 3.5) * 3 * (1 - t * 0.5);
      el.setAttribute('x', String(x + zigzag));
      el.setAttribute('y', String(startY - ease * rise));
      el.setAttribute('opacity', String(Math.max(0, opacity)));
      el.textContent = text;
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
