/** C — flash circle that expands and fades at a hex */
export function impact(
  g: SVGGElement, cx: number, cy: number,
  color: string, size: number,
): Promise<void> {
  const maxR = size * 0.65;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('fill', color);
  el.setAttribute('pointer-events', 'none');
  el.setAttribute('r', '0');
  g.appendChild(el);

  return new Promise(resolve => {
    const duration = 450;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const easeOut = 1 - (1 - t) ** 2;
      el.setAttribute('r', String(easeOut * maxR));
      el.setAttribute('opacity', String((1 - t) * 0.88));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
