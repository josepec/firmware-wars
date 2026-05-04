/** G — directional arrow from source to dest, fades after brief hold */
export function pushArrow(
  g: SVGGElement,
  fromPx: { x: number; y: number },
  toPx: { x: number; y: number },
  color: string, size: number,
): Promise<void> {
  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  const arrowLen = size * 0.65;
  const x2 = fromPx.x + nx * arrowLen;
  const y2 = fromPx.y + ny * arrowLen;

  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  shaft.setAttribute('x1', String(fromPx.x));
  shaft.setAttribute('y1', String(fromPx.y));
  shaft.setAttribute('x2', String(x2));
  shaft.setAttribute('y2', String(y2));
  shaft.setAttribute('stroke', color);
  shaft.setAttribute('stroke-width', '2.5');
  shaft.setAttribute('stroke-linecap', 'round');
  shaft.setAttribute('opacity', '0');
  shaft.setAttribute('pointer-events', 'none');
  g.appendChild(shaft);

  const hs = size * 0.18;
  const px = -ny * hs * 0.55, py = nx * hs * 0.55;
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  head.setAttribute('points', [
    `${x2 + nx * hs},${y2 + ny * hs}`,
    `${x2 - px},${y2 - py}`,
    `${x2 + px},${y2 + py}`,
  ].join(' '));
  head.setAttribute('fill', color);
  head.setAttribute('opacity', '0');
  head.setAttribute('pointer-events', 'none');
  g.appendChild(head);

  return new Promise(resolve => {
    const fadein = 120, hold = 280, fadeout = 220;
    const total = fadein + hold + fadeout;
    const start = performance.now();
    function tick(now: number): void {
      const e = now - start;
      let opacity: number;
      if (e < fadein) opacity = e / fadein;
      else if (e < fadein + hold) opacity = 1;
      else if (e < total) opacity = 1 - (e - fadein - hold) / fadeout;
      else { shaft.remove(); head.remove(); resolve(); return; }
      shaft.setAttribute('opacity', String(opacity));
      head.setAttribute('opacity', String(opacity));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
