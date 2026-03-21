import { ChangeDetectorRef, Component, inject, OnDestroy, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { classifyCode } from '../../shared/markdown/marked-extensions';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import { HexMapData, HexTypeDefinition } from '../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';
const PDF_WORKER_URL = `${API_URL}/scenarios-pdf`;

// same DOT_COLOR stuff as scenario-viewer
const DOT_COLOR_NAMES: Record<string, string> = {
  green: 'Verde', blue: 'Azul', yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo',
};
const DOT_COLOR_HEX: Record<string, string> = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316', red: '#ef4444',
};

interface ScenarioItem {
  id: string;
  title: string;
  numeroEscenario: number;
  numeroTurnos: number;
  numeroJugadores: number;
  numeroBots: number;
  ambientacion: string;
  objetivo: string;
  condicionDerrota: string;
  amenazaIds: string[];
  amenazaCounts: Record<string, number>;
  amenazaTurnos: Record<string, number[]>;
  despliegueMode: 'dots' | 'map';
  despliegueDots: Record<string, string>;
  linkedFunctions: string[];
  hexMap: HexMapData;
}

interface ThreatItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  linkedFunctions: string[];
  flowchart: { nodes: any[]; connections: any[] };
}

interface FunctionItem {
  id: string;
  name: string;
  type: string;
  version: string;
  range: string;
  damage: string;
  energy: string;
  cost: string;
  effects: string;
}

interface ThreatInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  count: number;
  turnos: number[];
}

@Component({
  selector: 'app-scenarios-print',
  imports: [RouterLink, HexMap],
  templateUrl: './scenarios-print.html',
  styleUrl: './scenarios-print.scss',
})
export class ScenariosPrint implements OnDestroy {
  scenarios = signal<ScenarioItem[]>([]);
  threats = signal<ThreatItem[]>([]);
  allFunctions = signal<FunctionItem[]>([]);
  hexTypes = signal<HexTypeDefinition[]>([]);
  ready = signal(false);

  readonly pdfUrl = PDF_WORKER_URL;
  readonly copyrightYears = new Date().getFullYear() > 2026
    ? `2026-${new Date().getFullYear()}`
    : '2026';

  private readonly isWorkerRequest = new URLSearchParams(window.location.search).has('worker');
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  private readonly afterPrintFn = () => {
    if (!this.isWorkerRequest) {
      this.router.navigate(['/docs/escenarios']);
    }
  };

  constructor() {
    if (this.isWorkerRequest) {
      document.body.setAttribute('data-worker', 'true');
    }
    window.addEventListener('afterprint', this.afterPrintFn);
    this.loadAll();
  }

  ngOnDestroy(): void {
    window.removeEventListener('afterprint', this.afterPrintFn);
  }

  print(): void { window.print(); }

  /* ── Data helpers ────────────────────────────────── */

  codeClass(text: string): string { return classifyCode(text) || ''; }

  renderInlineCode(text: string): string {
    if (!text) return '';
    const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe(text)
      .replace(/`([^`]+)`/g, (_, code: string) => {
        const cls = classifyCode(code);
        return `<code${cls ? ` class="${cls}"` : ''}>${code}</code>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  dotName(color: string): string { return DOT_COLOR_NAMES[color] ?? color; }
  dotHex(color: string): string { return DOT_COLOR_HEX[color] ?? color; }

  scenarioNum(s: ScenarioItem): string {
    return s.numeroEscenario < 10 ? '0' + s.numeroEscenario : '' + s.numeroEscenario;
  }

  getScenarioThreats(s: ScenarioItem): ThreatInfo[] {
    if (!s.amenazaIds?.length) return [];
    const ids = new Set(s.amenazaIds);
    return this.threats()
      .filter(t => ids.has(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        description: t.description ?? '',
        imageUrl: t.imageUrl ?? '',
        count: s.amenazaCounts?.[t.id] || 0,
        turnos: s.amenazaTurnos?.[t.id] || [],
      }));
  }

  getScenarioFunctions(s: ScenarioItem, type: 'attack' | 'passive'): FunctionItem[] {
    if (!s.linkedFunctions?.length) return [];
    const ids = new Set(s.linkedFunctions);
    return this.allFunctions()
      .filter(f => ids.has(f.id) && (type === 'passive' ? f.type === 'passive' : f.type !== 'passive'));
  }

  getThreatFunctions(t: ThreatItem, type: 'attack' | 'passive'): FunctionItem[] {
    if (!t.linkedFunctions?.length) return [];
    const ids = new Set(t.linkedFunctions);
    return this.allFunctions()
      .filter(f => ids.has(f.id) && (type === 'passive' ? f.type === 'passive' : f.type !== 'passive'));
  }

  specialHexTypes(s: ScenarioItem): HexTypeDefinition[] {
    const types = s.hexMap?.hexTypes;
    if (!types) return [];
    return types.filter(t => t.id !== 'normal' && t.id !== 'obstacle');
  }

  hexTypeCount(s: ScenarioItem, typeId: string): number {
    return s.hexMap?.hexes?.filter(h => h.typeId === typeId).length ?? 0;
  }

  miniHexPoints(): string {
    const sz = 12;
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push(`${sz * Math.cos(a)},${sz * Math.sin(a)}`);
    }
    return pts.join(' ');
  }

  threatUnitList(s: ScenarioItem): { label: string; marker: string; turno: number }[] {
    const threats = this.getScenarioThreats(s);
    const units: { label: string; marker: string; turno: number }[] = [];
    for (const t of threats) {
      const prefix = t.name.substring(0, 3).toUpperCase();
      for (let i = 1; i <= t.count; i++) {
        units.push({ label: `${t.name} ${i}`, marker: `${prefix}${i}`, turno: t.turnos[i - 1] ?? 0 });
      }
    }
    return units;
  }

  playerIndexes(s: ScenarioItem): number[] {
    const n = s.numeroJugadores ?? 2;
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  deployEntries(s: ScenarioItem): { player: string; color: string }[] {
    if (!s.despliegueDots) return [];
    const n = s.numeroJugadores ?? 2;
    return Object.entries(s.despliegueDots)
      .filter(([player]) => Number(player) <= n)
      .map(([player, color]) => ({ player, color }));
  }

  /* ── Flowchart (read-only, simplified for print) ── */

  readonly NODE_COLORS: Record<string, string> = {
    start: '#22c55e', action: '#3b82f6', condition: '#eab308', end: '#ef4444',
  };

  nodeColor(type: string): string { return this.NODE_COLORS[type] ?? '#666'; }

  nodeW(node: any): number {
    if (node.w) return node.w;
    const textW = (node.label?.length || 5) * 7.2 + 32;
    const base = Math.max(120, textW);
    return node.type === 'condition' ? base * 1.4 : base;
  }

  nodeH(node: any): number {
    if (node.h) return node.h;
    return node.type === 'condition' ? Math.max(44, 44 * 1.2) : 44;
  }

  nodePath(node: any): string {
    const w = this.nodeW(node);
    const h = this.nodeH(node);
    if (node.type === 'condition') {
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
    }
    if (node.type === 'start' || node.type === 'end') {
      const r = Math.min(h / 2, 22);
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }
    const r = 4;
    return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  }

  svgWidth(nodes: any[]): number {
    if (!nodes?.length) return 300;
    return Math.max(300, ...nodes.map((n: any) => n.x + this.nodeW(n) + 20));
  }

  svgHeight(nodes: any[]): number {
    if (!nodes?.length) return 150;
    return Math.max(150, ...nodes.map((n: any) => n.y + this.nodeH(n) + 20));
  }

  anchorPos(node: any, anchor: string): { x: number; y: number } {
    const w = this.nodeW(node);
    const h = this.nodeH(node);
    switch (anchor) {
      case 'top': return { x: node.x + w / 2, y: node.y };
      case 'bottom': return { x: node.x + w / 2, y: node.y + h };
      case 'left': return { x: node.x, y: node.y + h / 2 };
      case 'right': return { x: node.x + w, y: node.y + h / 2 };
      default: return { x: node.x, y: node.y };
    }
  }

  bestAnchors(from: any, to: any): { fromAnchor: string; toAnchor: string } {
    const anchors = ['top', 'bottom', 'left', 'right'];
    let best = { fromAnchor: 'bottom', toAnchor: 'top' };
    let minDist = Infinity;
    for (const fa of anchors) {
      const fp = this.anchorPos(from, fa);
      for (const ta of anchors) {
        const tp = this.anchorPos(to, ta);
        const dist = Math.hypot(fp.x - tp.x, fp.y - tp.y);
        if (dist < minDist) { minDist = dist; best = { fromAnchor: fa, toAnchor: ta }; }
      }
    }
    return best;
  }

  private controlPoint(p: { x: number; y: number }, anchor: string, offset: number): { x: number; y: number } {
    switch (anchor) {
      case 'top': return { x: p.x, y: p.y - offset };
      case 'bottom': return { x: p.x, y: p.y + offset };
      case 'left': return { x: p.x - offset, y: p.y };
      case 'right': return { x: p.x + offset, y: p.y };
      default: return p;
    }
  }

  connPath(c: any, nodes: any[]): string {
    const from = nodes.find((n: any) => n.id === c.from);
    const to = nodes.find((n: any) => n.id === c.to);
    if (!from || !to) return '';
    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);
    const offset = Math.max(40, Math.hypot(fp.x - tp.x, fp.y - tp.y) * 0.3);
    const fc = this.controlPoint(fp, fromAnchor, offset);
    const tc = this.controlPoint(tp, toAnchor, offset);
    return `M ${fp.x} ${fp.y} C ${fc.x} ${fc.y}, ${tc.x} ${tc.y}, ${tp.x} ${tp.y}`;
  }

  connMid(c: any, nodes: any[]): { x: number; y: number } {
    const from = nodes.find((n: any) => n.id === c.from);
    const to = nodes.find((n: any) => n.id === c.to);
    if (!from || !to) return { x: 0, y: 0 };
    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);
    return { x: (fp.x + tp.x) / 2, y: (fp.y + tp.y) / 2 };
  }

  /* ── Load all data ───────────────────────────────── */

  private async loadAll(): Promise<void> {
    try {
      const [scenariosResp, threatsResp, hexTypesResp, functionsResp] = await Promise.all([
        fetch(`${API_URL}/api/scenarios`),
        fetch(`${API_URL}/api/threats`),
        fetch(`${API_URL}/api/hex-types`),
        fetch(`${API_URL}/api/functions/admin`),
      ]);

      const scenariosRaw: any[] = scenariosResp.ok ? await scenariosResp.json() : [];
      const threatsRaw: any[] = threatsResp.ok ? await threatsResp.json() : [];
      const hexTypesRaw: HexTypeDefinition[] = hexTypesResp.ok ? await hexTypesResp.json() : [];
      const functionsRaw: any[] = functionsResp.ok ? await functionsResp.json() : [];

      // Map functions
      this.allFunctions.set(functionsRaw.map((f: any) => ({
        id: f.id,
        name: f.func_name,
        type: f.func_type ?? 'attack',
        version: f.version ?? '',
        range: f.range ?? '',
        damage: f.damage ?? '',
        energy: f.energy ?? '',
        cost: f.cost ?? '',
        effects: f.effects ?? '',
      })));

      this.hexTypes.set(hexTypesRaw);

      // Map threats
      this.threats.set(threatsRaw.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? '',
        imageUrl: t.data?.imageUrl ?? '',
        linkedFunctions: t.data?.linkedFunctions ?? [],
        flowchart: t.data?.flowchart ?? { nodes: [], connections: [] },
      })));

      // Map scenarios - sorted by numeroEscenario, merge hex types
      const builtIn = [
        { id: 'normal', name: 'Normal', color: '#1a2e1a', borderColor: '#2d4a2d', builtIn: true },
        { id: 'obstacle', name: 'Obstáculo', color: '#0a0a0a', borderColor: '#333333', builtIn: true },
      ];
      this.scenarios.set(
        scenariosRaw
          .map((s: any) => {
            const d = s.data ?? {};
            if (d.hexMap) {
              const fresh = hexTypesRaw.map(t => ({ ...t, builtIn: false }));
              d.hexMap.hexTypes = [...builtIn, ...fresh];
            }
            return {
              id: s.id,
              title: s.title ?? '',
              numeroEscenario: d.numeroEscenario ?? 0,
              numeroTurnos: d.numeroTurnos ?? 0,
              numeroJugadores: d.numeroJugadores ?? 2,
              numeroBots: d.numeroBots ?? 3,
              ambientacion: d.ambientacion ?? '',
              objetivo: d.objetivo ?? '',
              condicionDerrota: d.condicionDerrota ?? '',
              amenazaIds: d.amenazaIds ?? [],
              amenazaCounts: d.amenazaCounts ?? {},
              amenazaTurnos: d.amenazaTurnos ?? {},
              despliegueMode: d.despliegueMode ?? 'map',
              despliegueDots: d.despliegueDots ?? {},
              linkedFunctions: d.linkedFunctions ?? [],
              hexMap: d.hexMap ?? { hexes: [], hexTypes: [], deployments: [] },
            };
          })
          .sort((a: ScenarioItem, b: ScenarioItem) => a.numeroEscenario - b.numeroEscenario)
      );

      this.ready.set(true);
      this.cdr.markForCheck();

      // Signal ready for Puppeteer after a tick
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.setAttribute('data-pdf-ready', 'true');
          if (!this.isWorkerRequest) {
            // Don't auto-print for now, let user use the button
          }
        });
      });
    } catch (e) {
      console.error('[scenarios-print] Error loading data:', e);
      document.body.setAttribute('data-pdf-ready', 'true');
    }
  }
}
