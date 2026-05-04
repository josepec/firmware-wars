/** D — various centered aura effects on a bot's hex */
export type SelfAuraKind = 'heal' | 'shield' | 'buff' | 'rage' | 'charge' | 'fade';

export function selfAura(
  g: SVGGElement, cx: number, cy: number,
  color: string, kind: SelfAuraKind, size: number,
): Promise<void> {
  if (kind === 'heal') return _particles(g, cx, cy, color, size);
  if (kind === 'shield') return _pulseRing(g, cx, cy, color, size);
  if (kind === 'buff') return _expandRing(g, cx, cy, color, size);
  if (kind === 'rage') return _flash(g, cx, cy, '#dc2626', size);
  if (kind === 'charge') return _glow(g, cx, cy, color, size);
  return _flash(g, cx, cy, color, size); // fade
}

function _flash(g: SVGGElement, cx: number, cy: number, color: string, size: number): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('r', String(size * 0.5));
  el.setAttribute('fill', color);
  el.setAttribute('opacity', '0');
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);
  return new Promise(resolve => {
    const duration = 480;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      el.setAttribute('opacity', String(t < 0.25 ? (t / 0.25) * 0.5 : (1 - t) / 0.75 * 0.5));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

function _pulseRing(g: SVGGElement, cx: number, cy: number, color: string, size: number): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', '2');
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);
  return new Promise(resolve => {
    const duration = 600;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      el.setAttribute('r', String(size * (0.44 + Math.sin(t * Math.PI) * 0.12)));
      el.setAttribute('opacity', String(Math.sin(t * Math.PI) * 0.9));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    el.setAttribute('r', String(size * 0.44));
    requestAnimationFrame(tick);
  });
}

function _expandRing(g: SVGGElement, cx: number, cy: number, color: string, size: number): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', '2');
  el.setAttribute('r', '0');
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);
  return new Promise(resolve => {
    const duration = 550;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      el.setAttribute('r', String(ease * size * 0.75));
      el.setAttribute('opacity', String(1 - t));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

function _glow(g: SVGGElement, cx: number, cy: number, color: string, size: number): Promise<void> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('fill', color);
  el.setAttribute('r', '0');
  el.setAttribute('pointer-events', 'none');
  g.appendChild(el);
  return new Promise(resolve => {
    const duration = 600;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      el.setAttribute('r', String(t * size * 0.55));
      el.setAttribute('opacity', String((1 - t) * 0.65));
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

function _particles(g: SVGGElement, cx: number, cy: number, color: string, size: number): Promise<void> {
  const els: SVGCircleElement[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', String(cx + Math.cos(angle) * size * 0.22));
    el.setAttribute('cy', String(cy + Math.sin(angle) * size * 0.22));
    el.setAttribute('r', String(size * 0.09));
    el.setAttribute('fill', color);
    el.setAttribute('pointer-events', 'none');
    g.appendChild(el);
    els.push(el);
  }
  return new Promise(resolve => {
    const duration = 700;
    const rise = size * 1.1;
    const start = performance.now();
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      els.forEach((el, i) => {
        const angle = (i / 4) * Math.PI * 2;
        el.setAttribute('cy', String((cy + Math.sin(angle) * size * 0.22) - ease * rise));
        el.setAttribute('opacity', String(t < 0.6 ? 1 : (1 - t) / 0.4));
      });
      if (t < 1) requestAnimationFrame(tick);
      else { els.forEach(e => e.remove()); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
