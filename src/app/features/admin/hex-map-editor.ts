import { Component, computed, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import {
  HexMapData, HexCell, HexTypeDefinition, DeploymentMarker,
  DotColor, DOT_COLORS, DEFAULT_HEX_TYPES, hexToPixel, emptyMapData,
} from '../../shared/components/hex-map/hex-map.types';

type EditorTool = 'hex' | 'dot' | 'deploy' | 'erase';

@Component({
  selector: 'app-hex-map-editor',
  imports: [HexMap, FormsModule],
  templateUrl: './hex-map-editor.html',
  styleUrl: './hex-map-editor.scss',
})
export class HexMapEditor {
  readonly mapData = model<HexMapData>(emptyMapData());

  /* Editor state */
  readonly tool = signal<EditorTool>('hex');
  readonly selectedHexType = signal('normal');
  readonly selectedDotColor = signal<DotColor>('green');
  readonly selectedTeam = signal(1);

  /* Grid generation */
  readonly gridRows = signal(5);
  readonly gridCols = signal(5);

  /* Custom hex type form */
  readonly showTypeForm = signal(false);
  readonly newTypeName = signal('');
  readonly newTypeColor = signal('#4488ff');
  readonly newTypeBorder = signal('#2255aa');

  readonly dotColors = DOT_COLORS;
  readonly tools: { id: EditorTool; label: string }[] = [
    { id: 'hex', label: 'HEX' },
    { id: 'dot', label: 'DOT' },
    { id: 'deploy', label: 'DEPLOY' },
    { id: 'erase', label: 'BORRAR' },
  ];

  hexTypes = computed(() => this.mapData().hexTypes);
  totalHexes = computed(() => this.mapData().hexes.length);

  dotCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const c of DOT_COLORS) counts[c.id] = 0;
    for (const h of this.mapData().hexes) {
      if (h.dot) counts[h.dot] = (counts[h.dot] ?? 0) + 1;
    }
    return counts;
  });

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

    this.mapData.update(d => ({
      ...d,
      hexes,
      deployments: [],
    }));
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
      const updated = data.deployments.filter((_, i) => i !== idx);
      this.mapData.set({ ...data, deployments: updated });
    } else {
      const marker: DeploymentMarker = { q, r, team: this.selectedTeam() };
      this.mapData.set({ ...data, deployments: [...data.deployments, marker] });
    }
  }

  private eraseHex(q: number, r: number, data: HexMapData): void {
    this.mapData.set({
      ...data,
      hexes: data.hexes.filter(h => !(h.q === q && h.r === r)),
      deployments: data.deployments.filter(d => !(d.q === q && d.r === r)),
    });
  }

  addHexType(): void {
    const name = this.newTypeName().trim();
    if (!name) return;
    const id = 'custom-' + Date.now();
    const newType: HexTypeDefinition = {
      id, name,
      color: this.newTypeColor(),
      borderColor: this.newTypeBorder(),
      properties: {},
      builtIn: false,
    };
    this.mapData.update(d => ({
      ...d,
      hexTypes: [...d.hexTypes, newType],
    }));
    this.newTypeName.set('');
    this.showTypeForm.set(false);
    this.selectedHexType.set(id);
  }

  removeHexType(id: string): void {
    this.mapData.update(d => ({
      ...d,
      hexTypes: d.hexTypes.filter(t => t.id !== id),
      hexes: d.hexes.map(h => h.typeId === id ? { ...h, typeId: 'normal' } : h),
    }));
    if (this.selectedHexType() === id) this.selectedHexType.set('normal');
  }

  addSingleHex(): void {
    const data = this.mapData();
    if (data.hexes.length >= 100) return;

    // Find an empty adjacent position to the existing grid
    const existing = new Set(data.hexes.map(h => `${h.q},${h.r}`));
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

    for (const h of data.hexes) {
      for (const [dq, dr] of directions) {
        const nq = h.q + dq;
        const nr = h.r + dr;
        if (!existing.has(`${nq},${nr}`)) {
          this.mapData.set({
            ...data,
            hexes: [...data.hexes, { q: nq, r: nr, typeId: this.selectedHexType() }],
          });
          return;
        }
      }
    }

    // If no hexes exist yet, add at origin
    if (data.hexes.length === 0) {
      this.mapData.set({
        ...data,
        hexes: [{ q: 0, r: 0, typeId: this.selectedHexType() }],
      });
    }
  }
}
