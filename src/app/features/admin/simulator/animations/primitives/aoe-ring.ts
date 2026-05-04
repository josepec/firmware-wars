/** E — expanding (or imploding) stroke ring from a center point */
export function aoeRing(
  g: SVGGElement, cx: number, cy: number,
  color: string, maxR: number, implosion = false,
): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', '2');
  el.setAttribute('r', implosion ? String(maxR) : '0');
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);

  // Inner fill glow
  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fill.setAttribute('cx', String(cx));
  fill.setAttribute('cy', String(cy));
  fill.setAttribute('fill', color);
  fill.setAttribute('r', '0');
  fill.setAttribute('pointer-events', 'none');
  g.insertBefore(fill, el);

  return new Promise(resolve => {
    const duration = 480;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      const r = implosion ? maxR * (1 - ease) : maxR * ease;
      el.setAttribute('r', String(Math.max(0, r)));
      el.setAttribute('opacity', String((1 - t) * 0.9));
      fill.setAttribute('r', String(Math.max(0, r * 0.5)));
      fill.setAttribute('opacity', String((1 - t) * 0.18));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); fill.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
