import { Component, computed, input, output } from '@angular/core';
import { HexMapData, HexCell, DeploymentMarker, hexToPixel, hexPoints, hexNeighbors, DOT_COLORS } from './hex-map.types';

@Component({
  selector: 'app-hex-map',
  template: `
    <svg [attr.viewBox]="viewBox()" class="block mx-auto w-full h-auto max-w-[900px]"
         preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">

      <!-- 3D depth effect (bottom layer) -->
      @for (h of renderedHexes(); track h.key) {
        <polygon [attr.points]="h.depthPoints"
                 [attr.fill]="printMode() ? (h.isObstacle ? '#1a1a1a' : '#c8c8c8') : (h.isObstacle ? '#0a0a0a' : '#b0b0b0')"
                 stroke="none" />
      }

      <!-- Ghost hexes (valid placement positions) -->
      @for (g of ghostHexes(); track g.key) {
        <polygon [attr.points]="g.points"
                 fill="rgba(0,255,136,0.06)" stroke="rgba(0,255,136,0.2)"
                 stroke-width="1" stroke-dasharray="4,3"
                 class="cursor-pointer hover:fill-[rgba(0,255,136,0.15)]"
                 (click)="onGhostClick(g.q, g.r)" />
      }

      <!-- Hex faces: normal first, then special/obstacle on top -->
      @for (h of renderedHexes(); track h.key) {
        @if (!h.isSpecial && !h.isObstacle) {
        <polygon [attr.points]="h.points"
                 [attr.fill]="h.fill"
                 [attr.stroke]="h.stroke"
                 [attr.stroke-width]="h.strokeWidth"
                 class="hex-face"
                 [class.interactive]="interactive()"
                 [class.dragging]="dragHex()?.key === h.key"
                 (mousedown)="onDragStart($event, h.q, h.r)"
                 (click)="onHexClick(h.q, h.r)" />
        }
      }
      @for (h of renderedHexes(); track h.key) {
        @if (h.isSpecial || h.isObstacle) {
        <polygon [attr.points]="h.points"
                 [attr.fill]="h.fill"
                 [attr.stroke]="h.stroke"
                 [attr.stroke-width]="h.strokeWidth"
                 class="hex-face"
                 [class.interactive]="interactive()"
                 [class.dragging]="dragHex()?.key === h.key"
                 (mousedown)="onDragStart($event, h.q, h.r)"
                 (click)="onHexClick(h.q, h.r)" />
        }
      }

      <!-- Dots -->
      @for (h of renderedHexes(); track h.key) {
        @if (h.dotColor) {
          <circle [attr.cx]="h.dotCx" [attr.cy]="h.dotCy" [attr.r]="dotRadius()"
                  [attr.fill]="h.dotColor"
                  class="pointer-events-none" />
        }
      }

      <!-- Deployment markers -->
      @for (d of renderedDeployments(); track d.key) {
        <g [attr.transform]="'translate(' + d.cx + ',' + d.cy + ')'" class="pointer-events-none">
          @if (d.type === 'player') {
            <!-- Robot image -->
            <image href="/assets/img/bot.png"
                   [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                   [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                   preserveAspectRatio="xMidYMid meet" />
          } @else if (d.type === 'treasure') {
            <!-- Treasure image -->
            <image href="/assets/img/money.png"
                   [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                   [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                   preserveAspectRatio="xMidYMid meet" />
          } @else if (d.type === 'flag') {
            <!-- Flag image -->
            <image href="/assets/img/flag.png"
                   [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                   [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                   preserveAspectRatio="xMidYMid meet" />
          } @else if (d.type === 'plaque') {
            <!-- XP image -->
            <image href="/assets/img/xp.png"
                   [attr.x]="-(size() * 0.4)" [attr.y]="-(size() * 0.5)"
                   [attr.width]="size() * 0.8" [attr.height]="size() * 0.8"
                   preserveAspectRatio="xMidYMid meet" />
          } @else if (d.type === 'threat') {
            <!-- Threat marker: image or fallback skull -->
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
          <!-- Label -->
          <text [attr.y]="printMode() ? (d.type === 'player' ? 13 : 12) : (d.type === 'player' ? 16 : 15)" text-anchor="middle"
                [attr.font-size]="printMode() ? size() * 0.28 : size() * 0.3"
                [attr.fill]="printMode() ? '#1a5c28' : '#22d3ee'" font-family="'Orbitron', monospace" font-weight="700">
            {{ d.label }}
          </text>
        </g>
      }

      <!-- Drag ghost -->
      @if (dragGhost()) {
        <polygon [attr.points]="dragGhost()!.points"
                 fill="rgba(0,255,136,0.2)" stroke="#00ff88"
                 stroke-width="1.5" stroke-dasharray="4,3"
                 class="pointer-events-none" />
      }
    </svg>
  `,
  styles: [`
    .hex-face.interactive { cursor: pointer; }
    .hex-face.interactive:hover { opacity: 0.8; }
    .hex-face.dragging { opacity: 0.4; }
  `],
  host: {
    '(document:mousemove)': 'onDragMove($event)',
    '(document:mouseup)': 'onDragEnd($event)',
  },
})
export class HexMap {
  readonly mapData = input.required<HexMapData>();
  readonly size = input(30);
  readonly interactive = input(false);
  readonly showGhosts = input(false);
  readonly printMode = input(false);
  readonly hexClicked = output<{ q: number; r: number }>();
  readonly ghostClicked = output<{ q: number; r: number }>();
  readonly hexMoved = output<{ fromQ: number; fromR: number; toQ: number; toR: number }>();

  private padding = 20;
  private depthOffset = 6;

  /* Drag state */
  dragHex = input<{ key: string } | null>(null);
  dragGhost = computed<{ points: string } | null>(() => null); // placeholder for now

  dotRadius = computed(() => this.size() * 0.15);
  robotScale = computed(() => this.size() / 30);

  private allBounds = computed(() => {
    const s = this.size();
    const allCoords = [
      ...this.mapData().hexes.map(h => ({ q: h.q, r: h.r })),
      ...(this.showGhosts() ? this.ghostCoords() : []),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of allCoords) {
      const { x, y } = hexToPixel(h.q, h.r, s);
      minX = Math.min(minX, x - s);
      maxX = Math.max(maxX, x + s);
      minY = Math.min(minY, y - s);
      maxY = Math.max(maxY, y + s + this.depthOffset);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }
    return { minX, minY, maxX, maxY };
  });

  viewBox = computed(() => {
    const b = this.allBounds();
    const p = this.padding;
    return `${b.minX - p} ${b.minY - p} ${b.maxX - b.minX + p * 2} ${b.maxY - b.minY + p * 2}`;
  });

  private ghostCoords = computed(() => {
    const data = this.mapData();
    const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
    const ghosts: { q: number; r: number }[] = [];
    const seen = new Set<string>();
    for (const h of data.hexes) {
      for (const n of hexNeighbors(h.q, h.r)) {
        const key = `${n.q},${n.r}`;
        if (!existing.has(key) && !seen.has(key)) {
          seen.add(key);
          ghosts.push(n);
        }
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
      let fill = type.color;
      let stroke = type.borderColor;
      const isSpecial = h.typeId !== 'normal' && h.typeId !== 'obstacle';
      if (print) {
        if (h.typeId === 'normal') { fill = '#ffffff'; stroke = '#aaaaaa'; }
        else if (h.typeId === 'obstacle') { fill = '#1a1a1a'; stroke = '#333333'; }
        // Speciales: keep their own colors
      }
      return {
        key: `${h.q},${h.r}`,
        q: h.q,
        r: h.r,
        cx: x,
        cy: y,
        dotCx: x,
        dotCy: hasDeployment ? y - s * 0.65 : y,
        points: hexPoints(x, y, s),
        depthPoints: hexPoints(x, y + this.depthOffset, s),
        fill,
        stroke,
        strokeWidth: 2,
        isSpecial,
        isObstacle: h.typeId === 'obstacle',
        dotColor: dotDef?.hex ?? null,
      };
    });
  });

  renderedDeployments = computed(() => {
    const s = this.size();
    const data = this.mapData();
    return data.deployments.map(d => {
      const { x, y } = hexToPixel(d.q, d.r, s);
      return { key: `dep-${d.q},${d.r}`, cx: x, cy: y, type: d.type, label: d.label, imageUrl: d.imageUrl };
    });
  });

  /* ── Events ──────────────────────────────────────────────── */

  onHexClick(q: number, r: number): void {
    if (this.interactive()) {
      this.hexClicked.emit({ q, r });
    }
  }

  onGhostClick(q: number, r: number): void {
    this.ghostClicked.emit({ q, r });
  }

  /* ── Drag & Drop ─────────────────────────────────────────── */
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
    if (dx + dy < 8) return; // threshold
    // Show visual feedback via CSS
  }

  onDragEnd(event: MouseEvent): void {
    if (!this.dragging || !this.svgEl) return;
    const dx = Math.abs(event.clientX - this.dragging.startX);
    const dy = Math.abs(event.clientY - this.dragging.startY);

    if (dx + dy >= 8) {
      // Find nearest hex to drop position
      const pt = this.svgEl.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const svgPt = pt.matrixTransform(this.svgEl.getScreenCTM()!.inverse());

      const s = this.size();
      const data = this.mapData();
      let bestDist = Infinity;
      let bestQ = 0, bestR = 0;
      let foundGhost = false;

      // Check ghost positions (valid empty neighbors)
      const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
      for (const h of data.hexes) {
        for (const n of hexNeighbors(h.q, h.r)) {
          const nk = `${n.q},${n.r}`;
          if (existing.has(nk) && !(n.q === this.dragging.q && n.r === this.dragging.r)) continue;
          const { x, y } = hexToPixel(n.q, n.r, s);
          const dist = Math.sqrt((svgPt.x - x) ** 2 + (svgPt.y - y) ** 2);
          if (dist < s && dist < bestDist) {
            bestDist = dist;
            bestQ = n.q;
            bestR = n.r;
            foundGhost = !existing.has(nk) || (n.q === this.dragging.q && n.r === this.dragging.r);
          }
        }
      }

      if (bestDist < s && !(bestQ === this.dragging.q && bestR === this.dragging.r)) {
        this.hexMoved.emit({ fromQ: this.dragging.q, fromR: this.dragging.r, toQ: bestQ, toR: bestR });
      }
    }

    this.dragging = null;
    this.svgEl = null;
  }
}
