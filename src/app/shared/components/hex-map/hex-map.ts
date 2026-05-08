import { Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { HexMapData, HexMapEntity, hexToPixel, hexPoints, hexNeighbors, DOT_COLORS } from './hex-map.types';

interface RenderedEntity {
  key: string; q: number; r: number; cx: number; cy: number;
  kind: 'barrier' | 'relay_node'; teamColor: string;
}

interface RenderedDeployment {
  key: string; q: number; r: number; cx: number; cy: number; type: string; label: string; imageUrl?: string;
  active: boolean; turnBot: boolean; destroyed: boolean; tooltip: string | null; teamColor: string;
}

@Component({
  selector: 'app-hex-map',
  template: `
    <svg [attr.viewBox]="viewBox()" class="block mx-auto w-full h-auto max-w-[900px] overflow-visible"
         overflow="visible" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <g [attr.transform]="rotateTransform()">

      <!-- 3D depth -->
      @for (h of renderedHexes(); track h.key) {
        <polygon [attr.points]="h.depthPoints"
                 [attr.fill]="printMode() ? (h.isObstacle ? '#1a1a1a' : '#c8c8c8') : (h.isObstacle ? '#0a0a0a' : '#b0b0b0')"
                 stroke="none" />
      }

      <!-- Ghost hexes -->
      @for (g of ghostHexes(); track g.key) {
        <polygon [attr.points]="g.points"
                 fill="rgba(0,255,136,0.06)" stroke="rgba(0,255,136,0.2)"
                 stroke-width="1" stroke-dasharray="4,3"
                 class="cursor-pointer hover:fill-[rgba(0,255,136,0.15)]"
                 (click)="onGhostClick(g.q, g.r)" />
      }

      <!-- Normal hex faces -->
      @for (h of renderedHexes(); track h.key) {
        @if (!h.isSpecial && !h.isObstacle) {
          <polygon [attr.points]="h.points" [attr.fill]="h.fill"
                   [attr.stroke]="h.stroke" [attr.stroke-width]="h.strokeWidth"
                   class="hex-face" [class.interactive]="interactive()"
                   [class.dragging]="dragHex()?.key === h.key"
                   (mousedown)="onDragStart($event, h.q, h.r)"
                   (click)="onHexClick(h.q, h.r)" />
        }
      }
      <!-- Special / obstacle hex faces -->
      @for (h of renderedHexes(); track h.key) {
        @if (h.isSpecial || h.isObstacle) {
          <polygon [attr.points]="h.points" [attr.fill]="h.fill"
                   [attr.stroke]="h.stroke" [attr.stroke-width]="h.strokeWidth"
                   class="hex-face" [class.interactive]="interactive()"
                   [class.dragging]="dragHex()?.key === h.key"
                   (mousedown)="onDragStart($event, h.q, h.r)"
                   (click)="onHexClick(h.q, h.r)" />
        }
      }

      <!-- Dots -->
      @for (h of renderedHexes(); track h.key) {
        @if (h.dotColor) {
          <circle [attr.cx]="h.dotCx" [attr.cy]="h.dotCy" [attr.r]="dotRadius()"
                  [attr.fill]="h.dotColor" [attr.fill-opacity]="dotOpacity()"
                  class="pointer-events-none" />
        }
      }

      <!-- Map entities: barriers + relay nodes -->
      @for (e of renderedEntities(); track e.key) {
        <g [attr.transform]="'translate(' + e.cx + ',' + e.cy + ') rotate(' + (-rotateAngle()) + ')'"
           class="pointer-events-none">
          @if (e.kind === 'barrier') {
            <polygon [attr.points]="barrierHexPts()" fill="#111827" stroke="#4b5563" stroke-width="1.2" />
            <line [attr.x1]="-(size() * 0.38)" [attr.y1]="-(size() * 0.38)"
                  [attr.x2]="size() * 0.38" [attr.y2]="size() * 0.38"
                  stroke="#6b7280" stroke-width="1.5" />
            <line [attr.x1]="size() * 0.38" [attr.y1]="-(size() * 0.38)"
                  [attr.x2]="-(size() * 0.38)" [attr.y2]="size() * 0.38"
                  stroke="#6b7280" stroke-width="1.5" />
          } @else if (e.kind === 'relay_node') {
            <circle [attr.r]="size() * 0.35" [attr.fill]="e.teamColor"
                    fill-opacity="0.22" [attr.stroke]="e.teamColor" stroke-width="1.5" />
            <circle [attr.r]="size() * 0.42" [attr.stroke]="e.teamColor"
                    stroke-width="1.5" fill="none" class="animate-ping ping-ring" />
            <circle r="2.5" [attr.fill]="e.teamColor" />
          }
        </g>
      }

      <!-- Deployment markers -->
      @for (d of renderedDeployments(); track d.key) {
        @if (d.type === 'player') {
          <g [attr.transform]="'translate(' + d.cx + ',' + d.cy + ') rotate(' + (-rotateAngle()) + ')'"
             [attr.opacity]="!d.destroyed && !d.active && hasAnyTurnBot() ? 0.65 : 1"
             [class.cursor-pointer]="interactive()"
             [class.cursor-grab]="interactive() && dragMode() === 'move'"
             (mouseenter)="onBotHover(d)" (mouseleave)="hoveredTooltip.set(null)"
             (mousedown)="onDragStart($event, d.q, d.r)"
             (click)="onHexClick(d.q, d.r)">
            <!-- Team ring: tenue siempre, brillante cuando active (seleccionado en panel) -->
            @if (!d.destroyed) {
              <circle [attr.r]="size() * 0.44" [attr.stroke]="d.teamColor"
                      stroke-width="1" stroke-opacity="0.35"
                      fill="none" class="pointer-events-none" />
            }
            <!-- Ping ring: solo el bot con el turno activo -->
            @if (d.turnBot && !d.destroyed) {
              <circle [attr.r]="size() * 0.52" [attr.stroke]="d.teamColor"
                      stroke-width="2" fill="none"
                      class="animate-ping ping-ring pointer-events-none" />
            }
            @if (d.destroyed) {
              <image href="/assets/img/destroyed-bot.png"
                     [attr.x]="-(size() * 0.5)" [attr.y]="-(size() * 0.55)"
                     [attr.width]="size()" [attr.height]="size()"
                     preserveAspectRatio="xMidYMid meet" />
            } @else {
              <image href="/assets/img/bot.png"
                     [attr.x]="-(size() * 0.5)" [attr.y]="-(size() * 0.55)"
                     [attr.width]="size()" [attr.height]="size()"
                     preserveAspectRatio="xMidYMid meet" />
            }
          </g>
        } @else {
          <g [attr.transform]="'translate(' + d.cx + ',' + d.cy + ') rotate(' + (-rotateAngle()) + ')'"
             class="pointer-events-none">
            @if (d.type === 'treasure') {
              <image href="/assets/img/money.png"
                     [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                     [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                     preserveAspectRatio="xMidYMid meet" />
            } @else if (d.type === 'flag') {
              <image href="/assets/img/flag.png"
                     [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                     [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                     preserveAspectRatio="xMidYMid meet" />
            } @else if (d.type === 'plaque') {
              <image href="/assets/img/xp.png"
                     [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                     [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                     preserveAspectRatio="xMidYMid meet" />
            } @else if (d.type === 'threat') {
              @if (d.imageUrl) {
                <image [attr.href]="d.imageUrl"
                       [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                       [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                       preserveAspectRatio="xMidYMid meet" />
              } @else {
                <g [attr.transform]="'scale(' + robotScale() + ')'">
                  <circle cx="0" cy="-3" r="6" fill="#dc2626" stroke="#991b1b" stroke-width="0.8"/>
                  <text y="-0.5" text-anchor="middle" font-size="9" fill="white" font-weight="700">!</text>
                </g>
              }
            }
            <text [attr.y]="printMode() ? 12 : 15" text-anchor="middle"
                  [attr.font-size]="printMode() ? size() * 0.28 : size() * 0.3"
                  [attr.fill]="printMode() ? '#1a5c28' : '#22d3ee'"
                  font-family="'Orbitron', monospace" font-weight="700">
              {{ d.label }}
            </text>
          </g>
        }
      }

      <!-- Attack range overlay (subtle fill, below highlight strokes) -->
      @for (h of rangeHexOverlays(); track h.key) {
        <polygon [attr.points]="h.points" fill="#ef4444" fill-opacity="0.10"
                 stroke="none" class="pointer-events-none" />
      }

      <!-- Highlight overlay -->
      @for (h of highlightOverlays(); track h.key) {
        <polygon [attr.points]="h.points" fill="none"
                 [attr.stroke]="h.color" stroke-width="3"
                 class="pointer-events-none" />
      }

      <!-- Drag ghost -->
      @if (dragGhost()) {
        <polygon [attr.points]="dragGhost()!.points"
                 fill="rgba(0,255,136,0.2)" stroke="#00ff88"
                 stroke-width="1.5" stroke-dasharray="4,3"
                 class="pointer-events-none" />
      }

      <!-- Hover tooltip (last = always on top) -->
      @if (hoveredTooltip(); as tt) {
        <g [attr.transform]="'translate(' + tt.cx + ',' + tt.cy + ') rotate(' + (-rotateAngle()) + ')'">
          <rect [attr.x]="size() * 0.55"
                [attr.y]="-(size() * 0.6) - tt.lines.length * 10 - 8"
                width="104" [attr.height]="tt.lines.length * 10 + 8"
                rx="2" fill="rgba(0,0,0,0.88)"
                [attr.stroke]="tt.destroyed ? '#ef4444' : tt.teamColor"
                stroke-opacity="0.55" stroke-width="0.8"
                class="pointer-events-none" />
          @for (line of tt.lines; track $index; let i = $index) {
            <text [attr.x]="size() * 0.55 + 5"
                  [attr.y]="-(size() * 0.6) - tt.lines.length * 10 - 8 + 11 + i * 10"
                  [attr.font-size]="i === 0 && tt.destroyed ? 8.5 : 7.5"
                  [attr.font-weight]="i === 0 && tt.destroyed ? '700' : '400'"
                  [attr.fill]="i === 0 && tt.destroyed ? '#ef4444' : (tt.destroyed ? '#6b7280' : tt.teamColor)"
                  font-family="'Orbitron', monospace"
                  class="pointer-events-none">{{ line }}</text>
          }
        </g>
      }

      </g>
      <!-- Animation overlay: always on top, same coordinate space as main <g> -->
      <g class="anim-layer" [attr.transform]="rotateTransform()"></g>
    </svg>
  `,
  styles: [`
    .hex-face.interactive { cursor: pointer; }
    .hex-face.interactive:hover { opacity: 0.8; }
    .hex-face.dragging { opacity: 0.4; }
    .ping-ring { transform-box: fill-box; transform-origin: center; }
  `],
  host: {
    '(document:mousemove)': 'onDragMove($event)',
    '(document:mouseup)': 'onDragEnd($event)',
  },
})
export class HexMap {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  getAnimLayer(): SVGGElement | null {
    return this.elRef.nativeElement.querySelector('.anim-layer') as SVGGElement | null;
  }

  readonly mapData = input.required<HexMapData>();
  readonly size = input(30);
  readonly interactive = input(false);
  readonly showGhosts = input(false);
  readonly printMode = input(false);
  readonly rotateAngle = input(0);
  readonly highlightedHexes = input<Set<string> | null>(null);
  readonly highlightColor = input<string>('#3b82f6');
  readonly selectable = input<Set<string> | null>(null);
  readonly dotOpacity = input(1.0);
  readonly rangeHexes = input<Set<string> | null>(null);
  readonly mapEntities = input<HexMapEntity[]>([]);
  /**
   * Drag&drop mode:
   * - 'expand': drop on EMPTY neighbor cells (used by map editor to grow the map)
   * - 'move': drop on ANY existing hex (used by simulator debug to move bots)
   */
  readonly dragMode = input<'expand' | 'move'>('expand');
  readonly hexClicked = output<{ q: number; r: number }>();
  readonly ghostClicked = output<{ q: number; r: number }>();
  readonly hexMoved = output<{ fromQ: number; fromR: number; toQ: number; toR: number }>();

  private padding = 20;
  private depthOffset = 6;

  dragHex = input<{ key: string } | null>(null);
  dragGhost = computed<{ points: string } | null>(() => null);

  dotRadius = computed(() => this.size() * 0.15);
  robotScale = computed(() => this.size() / 30);
  barrierHexPts = computed(() => hexPoints(0, 0, this.size() * 0.72));

  renderedEntities = computed<RenderedEntity[]>(() => {
    const s = this.size();
    return this.mapEntities().map(e => {
      const { x, y } = hexToPixel(e.q, e.r, s);
      return {
        key: `ent-${e.q},${e.r}`,
        q: e.q, r: e.r, cx: x, cy: y,
        kind: e.kind,
        teamColor: e.teamColor ?? '#94a3b8',
      };
    });
  });

  hoveredTooltip = signal<{ cx: number; cy: number; lines: string[]; teamColor: string; destroyed: boolean } | null>(null);
  hasAnyTurnBot = computed(() => this.renderedDeployments().some(d => d.type === 'player' && d.turnBot));

  private rawBounds = computed(() => {
    const s = this.size();
    const allCoords = [
      ...this.mapData().hexes.map(h => ({ q: h.q, r: h.r })),
      ...(this.showGhosts() ? this.ghostCoords() : []),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of allCoords) {
      const { x: cx, y: cy } = hexToPixel(h.q, h.r, s);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const vx = cx + s * Math.cos(angle);
        const vy = cy + s * Math.sin(angle);
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        const vyDepth = vy + this.depthOffset;
        if (vyDepth > maxY) maxY = vyDepth;
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }
    return { minX, minY, maxX, maxY };
  });

  private rotateCenter = computed(() => {
    const b = this.rawBounds();
    return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 };
  });

  rotateTransform = computed(() => {
    const a = this.rotateAngle();
    if (a === 0) return '';
    const { cx, cy } = this.rotateCenter();
    return `rotate(${a} ${cx} ${cy})`;
  });

  viewBox = computed(() => {
    const p = this.padding;
    const a = this.rotateAngle();
    if (a === 0) {
      const b = this.rawBounds();
      return `${b.minX - p} ${b.minY - p} ${b.maxX - b.minX + p * 2} ${b.maxY - b.minY + p * 2}`;
    }
    const s = this.size();
    const { cx: rcx, cy: rcy } = this.rotateCenter();
    const rad = (a * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const allCoords = [
      ...this.mapData().hexes.map(h => ({ q: h.q, r: h.r })),
      ...(this.showGhosts() ? this.ghostCoords() : []),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const addRotated = (x: number, y: number) => {
      const dx = x - rcx, dy = y - rcy;
      const rx = rcx + dx * cos - dy * sin;
      const ry = rcy + dx * sin + dy * cos;
      if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
    };
    for (const h of allCoords) {
      const { x: hcx, y: hcy } = hexToPixel(h.q, h.r, s);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const vx = hcx + s * Math.cos(angle), vy = hcy + s * Math.sin(angle);
        addRotated(vx, vy); addRotated(vx, vy + this.depthOffset);
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }
    return `${minX - p} ${minY - p} ${maxX - minX + p * 2} ${maxY - minY + p * 2}`;
  });

  private ghostCoords = computed(() => {
    const data = this.mapData();
    const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
    const ghosts: { q: number; r: number }[] = [];
    const seen = new Set<string>();
    for (const h of data.hexes) {
      for (const n of hexNeighbors(h.q, h.r)) {
        const key = `${n.q},${n.r}`;
        if (!existing.has(key) && !seen.has(key)) { seen.add(key); ghosts.push(n); }
      }
    }
    return ghosts;
  });

  ghostHexes = computed(() => {
    if (!this.showGhosts() || !this.interactive()) return [];
    const s = this.size();
    return this.ghostCoords().map(g => {
      const { x, y } = hexToPixel(g.q, g.r, s);
      return { key: `g${g.q},${g.r}`, q: g.q, r: g.r, points: hexPoints(x, y, s) };
    });
  });

  renderedHexes = computed(() => {
    const s = this.size();
    const data = this.mapData();
    const print = this.printMode();
    const typeMap = new Map(data.hexTypes.map(t => [t.id, t]));
    const deployedSet = new Set(data.deployments.map(d => `${d.q},${d.r}`));
    return data.hexes.map(h => {
      const { x, y } = hexToPixel(h.q, h.r, s);
      const type = typeMap.get(h.typeId) ?? data.hexTypes[0];
      const dotDef = h.dot ? DOT_COLORS.find(d => d.id === h.dot) : null;
      const hasDeployment = deployedSet.has(`${h.q},${h.r}`);
      let fill = type.color, stroke = type.borderColor;
      const isSpecial = h.typeId !== 'normal' && h.typeId !== 'obstacle';
      if (print) {
        if (h.typeId === 'normal') { fill = '#ffffff'; stroke = '#aaaaaa'; }
        else if (h.typeId === 'obstacle') { fill = '#1a1a1a'; stroke = '#333333'; }
      }
      return {
        key: `${h.q},${h.r}`, q: h.q, r: h.r, cx: x, cy: y,
        dotCx: x, dotCy: hasDeployment ? y - s * 0.65 : y,
        points: hexPoints(x, y, s), depthPoints: hexPoints(x, y + this.depthOffset, s),
        fill, stroke, strokeWidth: 2, isSpecial, isObstacle: h.typeId === 'obstacle',
        dotColor: dotDef?.hex ?? null,
      };
    });
  });

  rangeHexOverlays = computed(() => {
    const set = this.rangeHexes();
    if (!set || set.size === 0) return [];
    const s = this.size();
    const out: { key: string; points: string }[] = [];
    for (const key of set) {
      const [qStr, rStr] = key.split(',');
      const q = Number(qStr), r = Number(rStr);
      if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
      const { x, y } = hexToPixel(q, r, s);
      out.push({ key: `range-${key}`, points: hexPoints(x, y, s * 0.84) });
    }
    return out;
  });

  highlightOverlays = computed(() => {
    const set = this.highlightedHexes();
    if (!set || set.size === 0) return [];
    const s = this.size();
    const color = this.highlightColor();
    const out: { key: string; points: string; color: string }[] = [];
    for (const key of set) {
      const [qStr, rStr] = key.split(',');
      const q = Number(qStr), r = Number(rStr);
      if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
      const { x, y } = hexToPixel(q, r, s);
      out.push({ key: `hl-${key}`, points: hexPoints(x, y, s * 0.9), color });
    }
    return out;
  });

  renderedDeployments = computed<RenderedDeployment[]>(() => {
    const s = this.size();
    const data = this.mapData();
    return data.deployments.map(d => {
      const { x, y } = hexToPixel(d.q, d.r, s);
      const teamColor = d.team === 1 ? '#22d3ee' : d.team === 2 ? '#e879f9' : '#22d3ee';
      return {
        key: `dep-${d.q},${d.r}`, q: d.q, r: d.r, cx: x, cy: y,
        type: d.type, label: d.label, imageUrl: d.imageUrl,
        active: d.active ?? false, turnBot: d.turnBot ?? false, destroyed: d.destroyed ?? false,
        tooltip: d.tooltip ?? null, teamColor,
      };
    });
  });

  onBotHover(d: RenderedDeployment): void {
    if (!d.tooltip) { this.hoveredTooltip.set(null); return; }
    const lines = d.destroyed
      ? ['◆  DESTROYED', ...d.tooltip.split('\n')]
      : d.tooltip.split('\n');
    this.hoveredTooltip.set({ cx: d.cx, cy: d.cy, lines, teamColor: d.teamColor, destroyed: d.destroyed });
  }

  onHexClick(q: number, r: number): void {
    if (!this.interactive()) return;
    const sel = this.selectable();
    if (sel && !sel.has(`${q},${r}`)) return;
    this.hexClicked.emit({ q, r });
  }

  onGhostClick(q: number, r: number): void {
    this.ghostClicked.emit({ q, r });
  }

  private dragging: { q: number; r: number; startX: number; startY: number } | null = null;
  private svgEl: SVGSVGElement | null = null;

  onDragStart(event: MouseEvent, q: number, r: number): void {
    if (!this.interactive()) return;
    this.dragging = { q, r, startX: event.clientX, startY: event.clientY };
    this.svgEl = (event.target as SVGElement).closest('svg');
  }

  onDragMove(event: MouseEvent): void {
    if (!this.dragging || !this.svgEl) return;
    const dx = Math.abs(event.clientX - this.dragging.startX);
    const dy = Math.abs(event.clientY - this.dragging.startY);
    if (dx + dy < 8) return;
  }

  onDragEnd(event: MouseEvent): void {
    if (!this.dragging || !this.svgEl) return;
    const dx = Math.abs(event.clientX - this.dragging.startX);
    const dy = Math.abs(event.clientY - this.dragging.startY);
    if (dx + dy >= 8) {
      const pt = this.svgEl.createSVGPoint();
      pt.x = event.clientX; pt.y = event.clientY;
      const svgPt = pt.matrixTransform(this.svgEl.getScreenCTM()!.inverse());
      const s = this.size();
      const data = this.mapData();
      let bestDist = Infinity, bestQ = 0, bestR = 0;

      if (this.dragMode() === 'move') {
        // Drop on any existing hex (closest to drop point)
        for (const h of data.hexes) {
          const { x, y } = hexToPixel(h.q, h.r, s);
          const dist = Math.sqrt((svgPt.x - x) ** 2 + (svgPt.y - y) ** 2);
          if (dist < s && dist < bestDist) { bestDist = dist; bestQ = h.q; bestR = h.r; }
        }
      } else {
        // 'expand': drop on empty neighbor cells (map editor)
        const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
        for (const h of data.hexes) {
          for (const n of hexNeighbors(h.q, h.r)) {
            const nk = `${n.q},${n.r}`;
            if (existing.has(nk) && !(n.q === this.dragging!.q && n.r === this.dragging!.r)) continue;
            const { x, y } = hexToPixel(n.q, n.r, s);
            const dist = Math.sqrt((svgPt.x - x) ** 2 + (svgPt.y - y) ** 2);
            if (dist < s && dist < bestDist) { bestDist = dist; bestQ = n.q; bestR = n.r; }
          }
        }
      }

      if (bestDist < s && !(bestQ === this.dragging!.q && bestR === this.dragging!.r)) {
        this.hexMoved.emit({ fromQ: this.dragging!.q, fromR: this.dragging!.r, toQ: bestQ, toR: bestR });
      }
    }
    this.dragging = null;
    this.svgEl = null;
  }
}
