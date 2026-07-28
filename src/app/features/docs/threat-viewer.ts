import { Component, computed, input, OnChanges, signal, ViewEncapsulation } from '@angular/core';
import { classifyCode } from '../../shared/markdown/marked-extensions';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface FlowNode {
  id: string;
  type: 'start' | 'action' | 'condition' | 'end';
  label: string;
  x: number; y: number;
  w?: number; h?: number;
}

interface FlowConnection {
  from: string;
  to: string;
  label?: string;
}

interface ThreatData {
  name: string;
  description: string;
  imageUrl: string;
  linkedFunctions: string[];
  flowchart: { nodes: FlowNode[]; connections: FlowConnection[] };
}

type Anchor = 'top' | 'bottom' | 'left' | 'right';

const MIN_W = 120;
const CHAR_W = 7.2;
const PAD_X = 32;
const MIN_H = 44;

const NODE_COLORS: Record<string, string> = {
  start: '#22c55e', action: '#3b82f6', condition: '#eab308', end: '#ef4444',
};

@Component({
  selector: 'app-threat-viewer',
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (loading()) {
      <p class="text-green-400/80 text-xs tracking-wider animate-pulse">> LOADING...</p>
    } @else if (error()) {
      <p class="text-red-400/90 text-xs tracking-wider">> {{ error() }}</p>
    } @else if (data()) {

      <!-- Title -->
      <h1 class="threat-main-title">{{ data()!.name }}</h1>

      <!-- Header card: image + description side by side -->
      <section class="mb-8 threat-header">
        <div class="flex flex-col sm:flex-row gap-6 items-start p-5 border border-green-500/10 bg-green-500/[0.02]">
          @if (data()!.imageUrl) {
          <div class="w-full sm:w-40 flex-shrink-0 border border-green-500/15 bg-black/40 flex items-center justify-center p-3">
            <img [src]="data()!.imageUrl" [alt]="data()!.name"
                 class="max-w-full max-h-40 object-contain" />
          </div>
          }
          @if (data()!.description) {
          <div class="flex-1 min-w-0">
            <h2 class="section-title">Descripción</h2>
            <p class="section-text" [innerHTML]="renderInlineCode(data()!.description)"></p>
          </div>
          }
        </div>
      </section>

      <!-- Flowchart: full width -->
      @if (flowchartNodes().length > 0) {
      <section class="mb-8">
        <h2 class="section-title">Diagrama de Comportamiento</h2>
        <div class="overflow-auto border border-green-500/10 bg-[#0a0f0c] p-2">
          <svg [attr.width]="svgWidth()" [attr.height]="svgHeight()">
            <defs>
              <marker id="tv-arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgb(34 197 94 / 0.5)" />
              </marker>
            </defs>

            @for (c of flowchartConns(); track c.from + c.to) {
              <path [attr.d]="connPath(c)" fill="none" stroke="rgb(34 197 94 / 0.3)" stroke-width="2"
                    marker-end="url(#tv-arrowhead)" />
              @if (c.label) {
                <text [attr.x]="connMid(c).x" [attr.y]="connMid(c).y"
                      text-anchor="middle" dominant-baseline="middle"
                      fill="rgb(34 197 94 / 0.5)" font-size="9" class="select-none">
                  {{ c.label }}
                </text>
              }
            }

            @for (node of flowchartNodes(); track node.id) {
              <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'">
                <path [attr.d]="nodePath(node)"
                      [attr.fill]="nodeColor(node.type) + '15'"
                      [attr.stroke]="nodeColor(node.type) + '60'"
                      stroke-width="1.5" />
                <foreignObject [attr.x]="node.type === 'condition' ? nodeW(node) * 0.2 : 6"
                               y="0"
                               [attr.width]="node.type === 'condition' ? nodeW(node) * 0.6 : nodeW(node) - 12"
                               [attr.height]="nodeH(node)">
                  <div class="select-none"
                       style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                              font-family: monospace; font-size: 11px; letter-spacing: 0.05em;
                              text-align: center; line-height: 1.3; word-break: break-word; overflow: hidden;"
                       [style.color]="nodeColor(node.type) + 'cc'">
                    {{ node.label }}
                  </div>
                </foreignObject>
              </g>
            }
          </svg>
        </div>
      </section>
      }

      <!-- Functions: full width, side by side on desktop if both exist -->
      @if (attackFunctions().length > 0 || passiveFunctions().length > 0) {
      <div class="flex flex-col gap-8">

        @if (attackFunctions().length > 0) {
        <section>
          <h2 class="section-title">Funciones de Ataque</h2>
          <table class="fn-table">
            <thead>
              <tr>
                <th>Función</th>
                <th>V.</th>
                <th class="text-center">Rango</th>
                <th class="text-center">Daño</th>
                <th class="text-center">Energía</th>
                <th class="text-center">Coste</th>
                <th>Efectos</th>
              </tr>
            </thead>
            <tbody>
              @for (fn of attackFunctions(); track fn.name) {
              <tr>
                <td><code [class]="codeClass(fn.name)">{{ fn.name }}</code></td>
                <td class="text-center">{{ fn.version }}</td>
                <td class="text-center">{{ fn.range }}</td>
                <td class="text-center">{{ fn.damage }}</td>
                <td class="text-center">{{ fn.energy }}</td>
                <td class="text-center">{{ fn.cost }}◈</td>
                <td [innerHTML]="renderInlineCode(fn.effects)"></td>
              </tr>
              }
            </tbody>
          </table>
        </section>
        }

        @if (passiveFunctions().length > 0) {
        <section>
          <h2 class="section-title">Funciones Pasivas</h2>
          <table class="fn-table">
            <thead>
              <tr>
                <th style="width: 1%; white-space: nowrap;">Función</th>
                <th style="text-align: left;">Efectos</th>
              </tr>
            </thead>
            <tbody>
              @for (fn of passiveFunctions(); track fn.name) {
              <tr>
                <td><code [class]="codeClass(fn.name)">{{ fn.name }}</code></td>
                <td [innerHTML]="renderInlineCode(fn.effects)"></td>
              </tr>
              }
            </tbody>
          </table>
        </section>
        }

      </div>
      }
    }
  `,
  styles: [`
    app-threat-viewer .threat-main-title {
      font-family: 'Orbitron', monospace;
      font-size: clamp(1.5rem, 4vw, 2.25rem);
      font-weight: 900;
      color: #00ff88;
      text-shadow: 0 0 30px rgba(0, 255, 136, 0.45);
      letter-spacing: 0.06em;
      line-height: 1.2;
      margin: 0 0 1.75rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(0, 255, 136, 0.2);
    }
    app-threat-viewer .section-title {
      font-family: 'Orbitron', monospace;
      font-size: clamp(0.9rem, 2.5vw, 1.15rem);
      font-weight: 700;
      color: #4ade80;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
      padding-left: 0.875rem;
      border-left: 2px solid #00ff88;
    }
    app-threat-viewer .section-text {
      color: rgba(74, 222, 128, 0.8);
      line-height: 1.85;
      font-size: 0.9rem;
      white-space: pre-line;
    }
    app-threat-viewer .section-text code {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 0.85em;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.07);
      border: 1px solid rgba(0, 255, 136, 0.22);
      padding: 0.1em 0.45em;
      border-radius: 2px;
    }
    app-threat-viewer .section-text code.bs-kw    { color: var(--bs-kw);    background: color-mix(in srgb, var(--bs-kw)    7%, transparent); border-color: color-mix(in srgb, var(--bs-kw)    22%, transparent); }
    app-threat-viewer .section-text code.bs-fn    { color: var(--bs-fn);    background: color-mix(in srgb, var(--bs-fn)    7%, transparent); border-color: color-mix(in srgb, var(--bs-fn)    22%, transparent); }
    app-threat-viewer .section-text code.bs-var   { color: var(--bs-var);   background: color-mix(in srgb, var(--bs-var)   7%, transparent); border-color: color-mix(in srgb, var(--bs-var)   22%, transparent); }
    app-threat-viewer .section-text code.bs-const  { color: var(--bs-const);  background: color-mix(in srgb, var(--bs-const)  7%, transparent); border-color: color-mix(in srgb, var(--bs-const)  22%, transparent); }
    app-threat-viewer .section-text code.bs-status { color: var(--bs-status); background: color-mix(in srgb, var(--bs-status) 7%, transparent); border-color: color-mix(in srgb, var(--bs-status) 22%, transparent); }
    app-threat-viewer .section-text code.bs-bug    { color: var(--bs-status); background: transparent; border: none; padding: 0; }
    app-threat-viewer .section-text code.bs-phase  { color: var(--bs-type);   background: color-mix(in srgb, var(--bs-type)   7%, transparent); border-color: color-mix(in srgb, var(--bs-type)   22%, transparent); }
    app-threat-viewer .section-text strong { color: #f0fdf4; font-weight: 600; }
    app-threat-viewer .fn-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      border: 1px solid rgba(0, 255, 136, 0.12);
    }
    app-threat-viewer .fn-table thead {
      background: rgba(0, 255, 136, 0.04);
      border-bottom: 1px solid rgba(0, 255, 136, 0.25);
    }
    app-threat-viewer .fn-table th {
      font-family: 'Orbitron', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(0, 255, 136, 0.65);
      padding: 0.65rem 1rem;
      text-align: left;
      white-space: nowrap;
    }
    app-threat-viewer .fn-table tbody tr {
      border-bottom: 1px solid rgba(0, 255, 136, 0.07);
      transition: background 0.15s;
    }
    app-threat-viewer .fn-table tbody tr:last-child { border-bottom: none; }
    app-threat-viewer .fn-table tbody tr:hover { background: rgba(0, 255, 136, 0.03); }
    app-threat-viewer .fn-table td {
      color: rgba(74, 222, 128, 0.75);
      padding: 0.6rem 1rem;
      vertical-align: top;
      line-height: 1.6;
    }
    app-threat-viewer .fn-table td:not(:last-child) { white-space: nowrap; }
    app-threat-viewer .fn-table code {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 0.85em;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.07);
      border: 1px solid rgba(0, 255, 136, 0.22);
      padding: 0.1em 0.45em;
      border-radius: 2px;
    }
    app-threat-viewer .fn-table code.bs-kw    { color: var(--bs-kw);    background: color-mix(in srgb, var(--bs-kw)    7%, transparent); border-color: color-mix(in srgb, var(--bs-kw)    22%, transparent); }
    app-threat-viewer .fn-table code.bs-fn    { color: var(--bs-fn);    background: color-mix(in srgb, var(--bs-fn)    7%, transparent); border-color: color-mix(in srgb, var(--bs-fn)    22%, transparent); }
    app-threat-viewer .fn-table code.bs-var   { color: var(--bs-var);   background: color-mix(in srgb, var(--bs-var)   7%, transparent); border-color: color-mix(in srgb, var(--bs-var)   22%, transparent); }
    app-threat-viewer .fn-table code.bs-const  { color: var(--bs-const);  background: color-mix(in srgb, var(--bs-const)  7%, transparent); border-color: color-mix(in srgb, var(--bs-const)  22%, transparent); }
    app-threat-viewer .fn-table code.bs-status { color: var(--bs-status); background: color-mix(in srgb, var(--bs-status) 7%, transparent); border-color: color-mix(in srgb, var(--bs-status) 22%, transparent); }
    app-threat-viewer .fn-table code.bs-bug    { color: var(--bs-status); background: transparent; border: none; padding: 0; }
    app-threat-viewer .fn-table code.bs-phase  { color: var(--bs-type);   background: color-mix(in srgb, var(--bs-type)   7%, transparent); border-color: color-mix(in srgb, var(--bs-type)   22%, transparent); }
  `],
})
export class ThreatViewer implements OnChanges {
  readonly threatId = input.required<string>();

  loading = signal(false);
  error = signal('');
  data = signal<ThreatData | null>(null);
  threatFunctions = signal<{ name: string; type: string; version: string; range: string; damage: string; energy: string; cost: string; effects: string }[]>([]);

  private loadedId: string | null = null;

  attackFunctions = computed(() => this.threatFunctions().filter(f => f.type !== 'passive'));
  passiveFunctions = computed(() => this.threatFunctions().filter(f => f.type === 'passive'));
  flowchartNodes = computed(() => this.data()?.flowchart?.nodes ?? []);
  flowchartConns = computed(() => this.data()?.flowchart?.connections ?? []);

  codeClass(text: string): string { return classifyCode(text) || ''; }

  renderInlineCode(text: string): string {
    const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe(text)
      .replace(/`([^`]+)`/g, (_, code: string) => {
        const cls = classifyCode(code);
        return `<code${cls ? ` class="${cls}"` : ''}>${code}</code>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  /* ── Flowchart rendering (read-only) ────────────────── */

  svgWidth = computed(() => {
    const nodes = this.flowchartNodes();
    if (nodes.length === 0) return 400;
    return Math.max(400, ...nodes.map(n => n.x + this.nodeW(n) + 40));
  });

  svgHeight = computed(() => {
    const nodes = this.flowchartNodes();
    if (nodes.length === 0) return 200;
    return Math.max(200, ...nodes.map(n => n.y + this.nodeH(n) + 40));
  });

  nodeW(node: FlowNode): number {
    if (node.w) return node.w;
    const textW = node.label.length * CHAR_W + PAD_X;
    const base = Math.max(MIN_W, textW);
    return node.type === 'condition' ? base * 1.4 : base;
  }

  nodeH(node: FlowNode): number {
    if (node.h) return node.h;
    return node.type === 'condition' ? Math.max(MIN_H, MIN_H * 1.2) : MIN_H;
  }

  nodeColor(type: string): string { return NODE_COLORS[type] ?? '#666'; }

  nodePath(node: FlowNode): string {
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

  anchorPos(node: FlowNode, anchor: Anchor): { x: number; y: number } {
    const w = this.nodeW(node);
    const h = this.nodeH(node);
    switch (anchor) {
      case 'top': return { x: node.x + w / 2, y: node.y };
      case 'bottom': return { x: node.x + w / 2, y: node.y + h };
      case 'left': return { x: node.x, y: node.y + h / 2 };
      case 'right': return { x: node.x + w, y: node.y + h / 2 };
    }
  }

  bestAnchors(from: FlowNode, to: FlowNode): { fromAnchor: Anchor; toAnchor: Anchor } {
    const anchors: Anchor[] = ['top', 'bottom', 'left', 'right'];
    let best = { fromAnchor: 'bottom' as Anchor, toAnchor: 'top' as Anchor };
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

  private controlPoint(p: { x: number; y: number }, anchor: Anchor, offset: number): { x: number; y: number } {
    switch (anchor) {
      case 'top': return { x: p.x, y: p.y - offset };
      case 'bottom': return { x: p.x, y: p.y + offset };
      case 'left': return { x: p.x - offset, y: p.y };
      case 'right': return { x: p.x + offset, y: p.y };
    }
  }

  connPath(c: FlowConnection): string {
    const from = this.flowchartNodes().find(n => n.id === c.from);
    const to = this.flowchartNodes().find(n => n.id === c.to);
    if (!from || !to) return '';
    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);
    const offset = Math.max(40, Math.hypot(fp.x - tp.x, fp.y - tp.y) * 0.3);
    const fc = this.controlPoint(fp, fromAnchor, offset);
    const tc = this.controlPoint(tp, toAnchor, offset);
    return `M ${fp.x} ${fp.y} C ${fc.x} ${fc.y}, ${tc.x} ${tc.y}, ${tp.x} ${tp.y}`;
  }

  connMid(c: FlowConnection): { x: number; y: number } {
    const from = this.flowchartNodes().find(n => n.id === c.from);
    const to = this.flowchartNodes().find(n => n.id === c.to);
    if (!from || !to) return { x: 0, y: 0 };
    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);
    return { x: (fp.x + tp.x) / 2, y: (fp.y + tp.y) / 2 };
  }

  /* ── Data loading ───────────────────────────────────── */

  ngOnChanges(): void {
    const id = this.threatId();
    if (id && id !== this.loadedId) {
      this.loadedId = id;
      this.load(id);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [threatResp, functionsResp] = await Promise.all([
        fetch(`${API_URL}/api/threats/${id}`),
        fetch(`${API_URL}/api/functions/admin`),
      ]);
      if (!threatResp.ok) throw new Error('Not found');
      const json = await threatResp.json();
      const d: ThreatData = {
        name: json.name ?? '',
        description: json.description ?? '',
        imageUrl: json.data?.imageUrl ?? '',
        linkedFunctions: json.data?.linkedFunctions ?? [],
        flowchart: json.data?.flowchart ?? { nodes: [], connections: [] },
      };

      // Resolve linked functions
      if (d.linkedFunctions.length && functionsResp.ok) {
        const allFns: any[] = await functionsResp.json();
        const fnIds = new Set(d.linkedFunctions);
        this.threatFunctions.set(allFns
          .filter((f: any) => fnIds.has(f.id))
          .map((f: any) => ({
            name: f.func_name,
            type: f.func_type ?? 'attack',
            version: f.version ?? '',
            range: f.range ?? '',
            damage: f.damage ?? '',
            energy: f.energy ?? '',
            cost: f.cost ?? '',
            effects: f.effects ?? '',
          })));
      } else {
        this.threatFunctions.set([]);
      }

      this.data.set(d);
    } catch {
      this.error.set('Error al cargar la amenaza.');
    }
    this.loading.set(false);
  }
}
