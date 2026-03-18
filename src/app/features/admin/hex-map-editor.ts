import { Component, computed, input, model, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import {
  HexMapData, HexCell, HexTypeDefinition, DeploymentMarker,
  DotColor, DOT_COLORS, MarkerType, MARKER_TYPES,
  DEFAULT_HEX_TYPES, emptyMapData, hexNeighbors,
} from '../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

type EditorTool = 'hex' | 'dot' | 'deploy' | 'erase';

@Component({
  selector: 'app-hex-map-editor',
  imports: [HexMap, FormsModule],
  templateUrl: './hex-map-editor.html',
  styleUrl: './hex-map-editor.scss',
})
export class HexMapEditor implements OnInit {
  readonly mapData = model<HexMapData>(emptyMapData());
  readonly maxPlayers = input(3);
  readonly availableThreats = input<{ id: string; name: string; imageUrl: string }[]>([]);
  readonly amenazaCounts = model<Record<string, number>>({});

  /* Editor state */
  readonly tool = signal<EditorTool>('hex');
  readonly selectedHexType = signal('normal');
  readonly selectedDotColor = signal<DotColor>('green');
  readonly dotEraseMode = signal(false);
  readonly selectedMarkerType = signal<MarkerType>('player');
  readonly selectedTeam = signal(1);
  readonly selectedThreatId = signal<string | null>(null);

  readonly Math = Math;
  readonly playerRange = computed(() => Array.from({ length: this.maxPlayers() }, (_, i) => i + 1));

  /* Grid generation */
  readonly gridRows = signal(5);
  readonly gridCols = signal(5);

  /* Shared hex types from API */
  readonly sharedTypes = signal<HexTypeDefinition[]>([]);
  readonly loadingTypes = signal(false);

  readonly dotColors = DOT_COLORS;
  readonly markerTypes = MARKER_TYPES;
  readonly tools: { id: EditorTool; label: string }[] = [
    { id: 'hex', label: 'HEX' },
    { id: 'dot', label: 'DOT' },
    { id: 'deploy', label: 'DEPLOY' },
    { id: 'erase', label: 'BORRAR' },
  ];

  /** All available types: built-in + shared from API */
  hexTypes = computed(() => {
    const builtIn = DEFAULT_HEX_TYPES;
    const shared = this.sharedTypes().map(t => ({ ...t, builtIn: false }));
    return [...builtIn, ...shared];
  });
  totalHexes = computed(() => this.mapData().hexes.length);

  ngOnInit(): void {
    this.loadSharedTypes();
  }

  private async loadSharedTypes(): Promise<void> {
    this.loadingTypes.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/hex-types`);
      if (resp.ok) {
        const types: HexTypeDefinition[] = await resp.json();
        this.sharedTypes.set(types);
        // Ensure map data includes these types for rendering
        this.mapData.update(d => ({
          ...d,
          hexTypes: [...DEFAULT_HEX_TYPES, ...types.map(t => ({ ...t, builtIn: false }))],
        }));
      }
    } catch { /* ignore */ }
    this.loadingTypes.set(false);
  }

  dotCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const c of DOT_COLORS) counts[c.id] = 0;
    for (const h of this.mapData().hexes) {
      if (h.dot) counts[h.dot] = (counts[h.dot] ?? 0) + 1;
    }
    return counts;
  });

  getAmenazaCount(id: string): number { return this.amenazaCounts()[id] || 0; }
  getThreatDeployCount(id: string): number { return this.threatDeployCounts()[id] || 0; }

  /** Show ghost hexes when hex tool is active */
  showGhosts = computed(() => this.tool() === 'hex' && this.totalHexes() > 0 && this.totalHexes() < 100);

  generateGrid(): void {
    const rows = this.gridRows();
    const cols = this.gridCols();
    const hexes: HexCell[] = [];

    for (let r = 0; r < rows; r++) {
      const offset = Math.floor(r / 2);
      for (let c = -offset; c < cols - offset; c++) {
        hexes.push({ q: c, r, typeId: 'normal' });
      }
    }
    if (hexes.length > 100) hexes.length = 100;

    this.mapData.update(d => ({ ...d, hexes, deployments: [] }));
  }

  onHexClick(coord: { q: number; r: number }): void {
    const { q, r } = coord;
    const tool = this.tool();
    const data = this.mapData();

    if (tool === 'hex') {
      this.paintHex(q, r, data);
    } else if (tool === 'dot') {
      this.paintDot(q, r, data);
    } else if (tool === 'deploy') {
      this.toggleDeploy(q, r, data);
    } else if (tool === 'erase') {
      this.eraseHex(q, r, data);
    }
  }

  /** Place a new hex on a ghost position */
  onGhostClick(coord: { q: number; r: number }): void {
    const data = this.mapData();
    if (data.hexes.length >= 100) return;
    this.mapData.set({
      ...data,
      hexes: [...data.hexes, { q: coord.q, r: coord.r, typeId: this.selectedHexType() }],
    });
  }

  /** Move a hex via drag & drop */
  onHexMoved(event: { fromQ: number; fromR: number; toQ: number; toR: number }): void {
    const data = this.mapData();
    const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
    const targetKey = `${event.toQ},${event.toR}`;

    // Can only move to empty position
    if (existing.has(targetKey)) return;

    const hexes = data.hexes.map(h => {
      if (h.q === event.fromQ && h.r === event.fromR) {
        return { ...h, q: event.toQ, r: event.toR };
      }
      return h;
    });

    // Also move deployments on that hex
    const deployments = data.deployments.map(d => {
      if (d.q === event.fromQ && d.r === event.fromR) {
        return { ...d, q: event.toQ, r: event.toR };
      }
      return d;
    });

    this.mapData.set({ ...data, hexes, deployments });
  }

  private paintHex(q: number, r: number, data: HexMapData): void {
    const idx = data.hexes.findIndex(h => h.q === q && h.r === r);
    if (idx >= 0) {
      const updated = [...data.hexes];
      updated[idx] = { ...updated[idx], typeId: this.selectedHexType() };
      this.mapData.set({ ...data, hexes: updated });
    }
  }

  private paintDot(q: number, r: number, data: HexMapData): void {
    const idx = data.hexes.findIndex(h => h.q === q && h.r === r);
    if (idx < 0) return;

    const hex = data.hexes[idx];

    // Erase mode
    if (this.dotEraseMode()) {
      const updated = [...data.hexes];
      updated[idx] = { ...updated[idx], dot: undefined };
      this.mapData.set({ ...data, hexes: updated });
      return;
    }

    const color = this.selectedDotColor();

    // Toggle off if same color
    if (hex.dot === color) {
      const updated = [...data.hexes];
      updated[idx] = { ...updated[idx], dot: undefined };
      this.mapData.set({ ...data, hexes: updated });
      return;
    }

    // Check max 20 per color
    const counts = this.dotCounts();
    if ((counts[color] ?? 0) >= 20) return;

    const updated = [...data.hexes];
    updated[idx] = { ...updated[idx], dot: color };
    this.mapData.set({ ...data, hexes: updated });
  }

  private toggleDeploy(q: number, r: number, data: HexMapData): void {
    const idx = data.deployments.findIndex(d => d.q === q && d.r === r);
    if (idx >= 0) {
      this.mapData.set({ ...data, deployments: data.deployments.filter((_, i) => i !== idx) });
    } else {
      const mType = this.selectedMarkerType();

      if (mType === 'threat') {
        const threatId = this.selectedThreatId();
        if (!threatId) return;
        const threat = this.availableThreats().find(t => t.id === threatId);
        if (!threat) return;
        // Check max count for this threat
        const maxCount = this.amenazaCounts()[threatId] ?? 0;
        const placed = data.deployments.filter(d => d.type === 'threat' && d.threatId === threatId).length;
        if (placed >= maxCount) return;
        const label = this.nextLabel(mType, data, threatId);
        const marker: DeploymentMarker = {
          q, r, type: 'threat', label, threatId, imageUrl: threat.imageUrl,
        };
        this.mapData.set({ ...data, deployments: [...data.deployments, marker] });
        return;
      }

      const label = this.nextLabel(mType, data);
      const marker: DeploymentMarker = {
        q, r, type: mType, label,
        ...(mType === 'player' ? { team: this.selectedTeam() } : {}),
      };
      this.mapData.set({ ...data, deployments: [...data.deployments, marker] });
    }
  }

  /** Auto-generate next label for marker type (P1, T1, T2, B1...) */
  private nextLabel(type: MarkerType, data: HexMapData, threatId?: string): string {
    const def = MARKER_TYPES.find(m => m.id === type)!;
    if (type === 'player') return `${def.prefix}${this.selectedTeam()}`;
    if (type === 'threat' && threatId) {
      const existing = data.deployments.filter(d => d.type === 'threat' && d.threatId === threatId);
      const threat = this.availableThreats().find(t => t.id === threatId);
      const shortName = threat?.name?.substring(0, 3).toUpperCase() ?? 'A';
      return `${shortName}${existing.length + 1}`;
    }
    const existing = data.deployments.filter(d => d.type === type);
    return `${def.prefix}${existing.length + 1}`;
  }

  /** Threat deployment counts for display */
  threatDeployCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const d of this.mapData().deployments) {
      if (d.type === 'threat' && d.threatId) {
        counts[d.threatId] = (counts[d.threatId] ?? 0) + 1;
      }
    }
    return counts;
  });

  private eraseHex(q: number, r: number, data: HexMapData): void {
    this.mapData.set({
      ...data,
      hexes: data.hexes.filter(h => !(h.q === q && h.r === r)),
      deployments: data.deployments.filter(d => !(d.q === q && d.r === r)),
    });
  }

}
