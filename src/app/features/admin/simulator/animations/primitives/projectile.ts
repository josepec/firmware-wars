/** B — circle that travels from A to B with a trailing glow */
export function projectile(
  g: SVGGElement,
  fromX: number, fromY: number,
  toX: number, toY: number,
  color: string, radius: number, durationMs: number,
): Promise<void> {
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  trail.setAttribute('r', String(radius * 2));
  trail.setAttribute('fill', color);
  trail.setAttribute('opacity', '0.22');
  trail.setAttribute('pointer-events', 'none');
  trail.setAttribute('cx', String(fromX));
  trail.setAttribute('cy', String(fromY));

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('r', String(radius));
  circle.setAttribute('fill', color);
  circle.setAttribute('pointer-events', 'none');
  circle.setAttribute('cx', String(fromX));
  circle.setAttribute('cy', String(fromY));

  g.appendChild(trail);
  g.appendChild(circle);

  function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  return new Promise(resolve => {
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeInOut(t);
      const trailT = Math.max(0, t - 0.06);
      const te = easeInOut(trailT);

      circle.setAttribute('cx', String(fromX + (toX - fromX) * e));
      circle.setAttribute('cy', String(fromY + (toY - fromY) * e));
      trail.setAttribute('cx', String(fromX + (toX - fromX) * te));
      trail.setAttribute('cy', String(fromY + (toY - fromY) * te));

      if (t < 1) requestAnimationFrame(tick);
      else { circle.remove(); trail.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
