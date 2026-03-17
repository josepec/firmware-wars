import { Component, computed, input, output } from '@angular/core';
import { HexMapData, HexCell, DeploymentMarker, hexToPixel, hexPoints, DOT_COLORS } from './hex-map.types';

@Component({
  selector: 'app-hex-map',
  template: `
    <svg [attr.viewBox]="viewBox()" [attr.width]="svgWidth()" [attr.height]="svgHeight()"
         class="block mx-auto" xmlns="http://www.w3.org/2000/svg">

      <!-- 3D depth effect (bottom layer) -->
      @for (h of renderedHexes(); track h.key) {
        <polygon [attr.points]="h.depthPoints"
                 [attr.fill]="h.isObstacle ? '#0a0a0a' : '#b0b0b0'"
                 stroke="none" />
      }

      <!-- Hex faces -->
      @for (h of renderedHexes(); track h.key) {
        <polygon [attr.points]="h.points"
                 [attr.fill]="h.fill"
                 [attr.stroke]="h.stroke"
                 stroke-width="2"
                 class="hex-face"
                 [class.interactive]="interactive()"
                 (click)="onHexClick(h.q, h.r)" />
      }

      <!-- Dots -->
      @for (h of renderedHexes(); track h.key) {
        @if (h.dotColor) {
          <circle [attr.cx]="h.cx" [attr.cy]="h.cy" [attr.r]="dotRadius()"
                  [attr.fill]="h.dotColor"
                  [attr.stroke]="h.dotColor === '#ffffff' ? '#999' : 'none'"
                  stroke-width="0.5"
                  class="pointer-events-none" />
        }
      }

      <!-- Deployment markers (robot icons) -->
      @for (d of renderedDeployments(); track d.key) {
        <g [attr.transform]="'translate(' + d.cx + ',' + d.cy + ')'" class="pointer-events-none">
          <!-- Simple robot silhouette -->
          <g [attr.transform]="'scale(' + robotScale() + ')'">
            <!-- Body -->
            <rect x="-6" y="-4" width="12" height="10" rx="1.5" fill="#6b7280" stroke="#374151" stroke-width="0.8"/>
            <!-- Head -->
            <rect x="-4" y="-9" width="8" height="6" rx="1" fill="#9ca3af" stroke="#374151" stroke-width="0.8"/>
            <!-- Eyes -->
            <circle cx="-1.5" cy="-6.5" r="1" fill="#22d3ee"/>
            <circle cx="1.5" cy="-6.5" r="1" fill="#22d3ee"/>
            <!-- Antenna -->
            <line x1="0" y1="-9" x2="0" y2="-12" stroke="#9ca3af" stroke-width="0.8"/>
            <circle cx="0" cy="-12.5" r="1" fill="#f87171"/>
            <!-- Legs -->
            <rect x="-5" y="6" width="3" height="4" rx="0.5" fill="#6b7280" stroke="#374151" stroke-width="0.5"/>
            <rect x="2" y="6" width="3" height="4" rx="0.5" fill="#6b7280" stroke="#374151" stroke-width="0.5"/>
          </g>
          <!-- Team label -->
          <text y="18" text-anchor="middle"
                [attr.font-size]="size() * 0.3"
                fill="#22d3ee" font-family="'Orbitron', monospace" font-weight="700">
            P{{ d.team }}
          </text>
        </g>
      }
    </svg>
  `,
  styles: [`
    .hex-face.interactive { cursor: pointer; }
    .hex-face.interactive:hover { opacity: 0.8; }
  `],
})
export class HexMap {
  readonly mapData = input.required<HexMapData>();
  readonly size = input(30);
  readonly interactive = input(false);
  readonly hexClicked = output<{ q: number; r: number }>();

  private padding = 20;
  private depthOffset = 6;

  dotRadius = computed(() => this.size() * 0.15);
  robotScale = computed(() => this.size() / 30);

  private bounds = computed(() => {
    const s = this.size();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of this.mapData().hexes) {
      const { x, y } = hexToPixel(h.q, h.r, s);
      minX = Math.min(minX, x - s);
      maxX = Math.max(maxX, x + s);
      minY = Math.min(minY, y - s);
      maxY = Math.max(maxY, y + s + this.depthOffset);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
    return { minX, minY, maxX, maxY };
  });

  viewBox = computed(() => {
    const b = this.bounds();
    const p = this.padding;
    return `${b.minX - p} ${b.minY - p} ${b.maxX - b.minX + p * 2} ${b.maxY - b.minY + p * 2}`;
  });

  svgWidth = computed(() => {
    const b = this.bounds();
    return Math.min(b.maxX - b.minX + this.padding * 2, 900);
  });

  svgHeight = computed(() => {
    const b = this.bounds();
    const w = this.svgWidth();
    const natural = b.maxX - b.minX + this.padding * 2;
    return (b.maxY - b.minY + this.padding * 2) * (w / natural);
  });

  renderedHexes = computed(() => {
    const s = this.size();
    const data = this.mapData();
    const typeMap = new Map(data.hexTypes.map(t => [t.id, t]));

    return data.hexes.map(h => {
      const { x, y } = hexToPixel(h.q, h.r, s);
      const type = typeMap.get(h.typeId) ?? data.hexTypes[0];
      const dotDef = h.dot ? DOT_COLORS.find(d => d.id === h.dot) : null;
      return {
        key: `${h.q},${h.r}`,
        q: h.q,
        r: h.r,
        cx: x,
        cy: y,
        points: hexPoints(x, y, s),
        depthPoints: hexPoints(x, y + this.depthOffset, s),
        fill: type.color,
        stroke: type.borderColor,
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
      return { key: `dep-${d.q},${d.r}`, cx: x, cy: y, team: d.team };
    });
  });

  onHexClick(q: number, r: number): void {
    if (this.interactive()) {
      this.hexClicked.emit({ q, r });
    }
  }
}
