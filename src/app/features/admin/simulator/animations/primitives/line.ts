/** A — beam/laser drawn via stroke-dashoffset then faded out */
export function drawLine(
  g: SVGGElement,
  fromX: number, fromY: number,
  toX: number, toY: number,
  color: string, width: number, drawMs: number,
): Promise<void> {
  const total = Math.hypot(toX - fromX, toY - fromY) || 1;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', String(fromX));
  el.setAttribute('y1', String(fromY));
  el.setAttribute('x2', String(toX));
  el.setAttribute('y2', String(toY));
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', String(width));
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-dasharray', String(total));
  el.setAttribute('stroke-dashoffset', String(total));
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);

  return new Promise(resolve => {
    const fadeDur = 270;
    const start = performance.now();
    function tick(now: number): void {
      const elapsed = now - start;
      if (elapsed < drawMs) {
        const t = elapsed / drawMs;
        const ease = 1 - (1 - t) ** 3;
        el.setAttribute('stroke-dashoffset', String(total * (1 - ease)));
        requestAnimationFrame(tick);
      } else if (elapsed < drawMs + fadeDur) {
        el.setAttribute('stroke-dashoffset', '0');
        el.setAttribute('opacity', String(1 - (elapsed - drawMs) / fadeDur));
        requestAnimationFrame(tick);
      } else {
        el.remove();
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}
