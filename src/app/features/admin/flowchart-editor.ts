import { Component, model, signal, computed, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FlowNode, FlowConnection } from './threat-editor';

const MIN_W = 120;
const MIN_H = 44;
const CHAR_W = 7.2;  // approx px per char at font-size 11 monospace
const PAD_X = 32;     // horizontal padding
const PAD_Y = 24;     // vertical padding

type Anchor = 'top' | 'bottom' | 'left' | 'right';

@Component({
  selector: 'app-flowchart-editor',
  imports: [FormsModule],
  templateUrl: './flowchart-editor.html',
  styleUrl: './flowchart-editor.scss',
})
export class FlowchartEditor {
  readonly data = model<{ nodes: FlowNode[]; connections: FlowConnection[] }>({
    nodes: [],
    connections: [],
  });

  readonly svgEl = viewChild<ElementRef<SVGSVGElement>>('svgCanvas');

  /* UI state */
  readonly selectedNode = signal<string | null>(null);
  readonly connectingFrom = signal<string | null>(null);
  readonly connectingAnchor = signal<Anchor | null>(null);
  readonly dragNode = signal<string | null>(null);
  readonly dragOffset = signal({ x: 0, y: 0 });

  /* Resize state */
  readonly resizingNode = signal<string | null>(null);
  readonly resizeStart = signal({ x: 0, y: 0, w: 0, h: 0 });

  /* Add node form */
  readonly newNodeType = signal<FlowNode['type']>('action');
  readonly newNodeLabel = signal('');

  /* Edit label */
  readonly editingNode = signal<string | null>(null);
  readonly editLabel = signal('');

  /* Connection label */
  readonly editingConn = signal<string | null>(null);
  readonly editConnLabel = signal('');

  readonly nodeTypes: { id: FlowNode['type']; label: string; color: string }[] = [
    { id: 'start', label: 'Inicio', color: '#22c55e' },
    { id: 'action', label: 'Accion', color: '#3b82f6' },
    { id: 'condition', label: 'Condicion', color: '#eab308' },
    { id: 'end', label: 'Fin', color: '#ef4444' },
  ];

  svgWidth = computed(() => {
    const nodes = this.data().nodes;
    if (nodes.length === 0) return 800;
    return Math.max(800, ...nodes.map(n => n.x + this.nodeW(n) + 40));
  });

  svgHeight = computed(() => {
    const nodes = this.data().nodes;
    if (nodes.length === 0) return 400;
    return Math.max(400, ...nodes.map(n => n.y + this.nodeH(n) + 40));
  });

  /** Compute node width based on label */
  nodeW(node: FlowNode): number {
    if (node.w) return node.w;
    const textW = node.label.length * CHAR_W + PAD_X;
    const base = Math.max(MIN_W, textW);
    // Diamonds need more space
    return node.type === 'condition' ? base * 1.4 : base;
  }

  /** Compute node height based on label */
  nodeH(node: FlowNode): number {
    if (node.h) return node.h;
    return node.type === 'condition' ? Math.max(MIN_H, MIN_H * 1.2) : MIN_H;
  }

  getNode(id: string): FlowNode | undefined {
    return this.data().nodes.find(n => n.id === id);
  }

  nodeColor(type: FlowNode['type']): string {
    return this.nodeTypes.find(t => t.id === type)?.color ?? '#666';
  }

  /** Get anchor point coordinates for a node */
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

  /** Find the best pair of anchors between two nodes */
  bestAnchors(from: FlowNode, to: FlowNode): { fromAnchor: Anchor; toAnchor: Anchor } {
    const anchors: Anchor[] = ['top', 'bottom', 'left', 'right'];
    let best = { fromAnchor: 'bottom' as Anchor, toAnchor: 'top' as Anchor };
    let minDist = Infinity;
    for (const fa of anchors) {
      const fp = this.anchorPos(from, fa);
      for (const ta of anchors) {
        if (fa === ta && this.opposite(fa) !== ta) continue; // allow same side for different nodes
        const tp = this.anchorPos(to, ta);
        const dist = Math.hypot(fp.x - tp.x, fp.y - tp.y);
        if (dist < minDist) {
          minDist = dist;
          best = { fromAnchor: fa, toAnchor: ta };
        }
      }
    }
    return best;
  }

  private opposite(a: Anchor): Anchor {
    const map: Record<Anchor, Anchor> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    return map[a];
  }

  /** Anchor positions relative to node origin (for template) */
  anchorRelative(node: FlowNode, anchor: Anchor): { cx: number; cy: number } {
    const w = this.nodeW(node);
    const h = this.nodeH(node);
    switch (anchor) {
      case 'top': return { cx: w / 2, cy: 0 };
      case 'bottom': return { cx: w / 2, cy: h };
      case 'left': return { cx: 0, cy: h / 2 };
      case 'right': return { cx: w, cy: h / 2 };
    }
  }

  readonly anchorList: Anchor[] = ['top', 'bottom', 'left', 'right'];

  addNode(): void {
    const label = this.newNodeLabel().trim();
    if (!label) return;
    const id = 'n' + Date.now();
    const nodes = this.data().nodes;
    const x = 40 + (nodes.length % 4) * 200;
    const y = 40 + Math.floor(nodes.length / 4) * 120;
    const node: FlowNode = { id, type: this.newNodeType(), label, x, y };
    this.data.update(d => ({ ...d, nodes: [...d.nodes, node] }));
    this.newNodeLabel.set('');
  }

  deleteNode(id: string): void {
    this.data.update(d => ({
      nodes: d.nodes.filter(n => n.id !== id),
      connections: d.connections.filter(c => c.from !== id && c.to !== id),
    }));
    if (this.selectedNode() === id) this.selectedNode.set(null);
  }

  startEdit(node: FlowNode): void {
    this.editingNode.set(node.id);
    this.editLabel.set(node.label);
  }

  saveEdit(): void {
    const id = this.editingNode();
    if (!id) return;
    const label = this.editLabel().trim();
    if (label) {
      this.data.update(d => ({
        ...d,
        nodes: d.nodes.map(n => {
          if (n.id !== id) return n;
          // Reset w/h so auto-size recalculates with new label
          return { ...n, label, w: undefined, h: undefined };
        }),
      }));
    }
    this.editingNode.set(null);
  }

  /** Connection mode: click anchor on first node, then anchor on second */
  startConnect(id: string, anchor: Anchor): void {
    const from = this.connectingFrom();
    if (!from) {
      this.connectingFrom.set(id);
      this.connectingAnchor.set(anchor);
      return;
    }
    if (from === id) {
      this.connectingFrom.set(null);
      this.connectingAnchor.set(null);
      return;
    }
    const exists = this.data().connections.some(c => c.from === from && c.to === id);
    if (!exists) {
      this.data.update(d => ({
        ...d,
        connections: [...d.connections, { from, to: id }],
      }));
    }
    this.connectingFrom.set(null);
    this.connectingAnchor.set(null);
  }

  deleteConnection(from: string, to: string): void {
    this.data.update(d => ({
      ...d,
      connections: d.connections.filter(c => !(c.from === from && c.to === to)),
    }));
  }

  connKey(c: FlowConnection): string {
    return `${c.from}->${c.to}`;
  }

  startEditConn(c: FlowConnection): void {
    this.editingConn.set(this.connKey(c));
    this.editConnLabel.set(c.label ?? '');
  }

  saveConnLabel(c: FlowConnection): void {
    const label = this.editConnLabel().trim();
    this.data.update(d => ({
      ...d,
      connections: d.connections.map(conn =>
        conn.from === c.from && conn.to === c.to ? { ...conn, label: label || undefined } : conn
      ),
    }));
    this.editingConn.set(null);
  }

  /** Get path for a connection arrow using best anchors */
  connPath(c: FlowConnection): string {
    const from = this.getNode(c.from);
    const to = this.getNode(c.to);
    if (!from || !to) return '';

    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);

    // Control point offset based on anchor direction
    const offset = Math.max(40, Math.hypot(fp.x - tp.x, fp.y - tp.y) * 0.3);
    const fc = this.controlPoint(fp, fromAnchor, offset);
    const tc = this.controlPoint(tp, toAnchor, offset);

    return `M ${fp.x} ${fp.y} C ${fc.x} ${fc.y}, ${tc.x} ${tc.y}, ${tp.x} ${tp.y}`;
  }

  private controlPoint(p: { x: number; y: number }, anchor: Anchor, offset: number): { x: number; y: number } {
    switch (anchor) {
      case 'top': return { x: p.x, y: p.y - offset };
      case 'bottom': return { x: p.x, y: p.y + offset };
      case 'left': return { x: p.x - offset, y: p.y };
      case 'right': return { x: p.x + offset, y: p.y };
    }
  }

  /** Midpoint of connection for label placement */
  connMid(c: FlowConnection): { x: number; y: number } {
    const from = this.getNode(c.from);
    const to = this.getNode(c.to);
    if (!from || !to) return { x: 0, y: 0 };
    const { fromAnchor, toAnchor } = this.bestAnchors(from, to);
    const fp = this.anchorPos(from, fromAnchor);
    const tp = this.anchorPos(to, toAnchor);
    return { x: (fp.x + tp.x) / 2, y: (fp.y + tp.y) / 2 };
  }

  /* ── Drag & drop ────────────────────────────────────── */
  onMouseDown(event: MouseEvent, nodeId: string): void {
    if (this.editingNode() === nodeId) return;
    const node = this.getNode(nodeId);
    if (!node) return;

    const svgPt = this.toSvg(event);
    if (!svgPt) return;

    this.dragNode.set(nodeId);
    this.dragOffset.set({ x: svgPt.x - node.x, y: svgPt.y - node.y });
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    // Handle resize
    const resizeId = this.resizingNode();
    if (resizeId) {
      const svgPt = this.toSvg(event);
      if (!svgPt) return;
      const start = this.resizeStart();
      const dw = svgPt.x - start.x;
      const dh = svgPt.y - start.y;
      const newW = Math.max(MIN_W, start.w + dw);
      const newH = Math.max(MIN_H, start.h + dh);
      this.data.update(d => ({
        ...d,
        nodes: d.nodes.map(n => n.id === resizeId ? { ...n, w: newW, h: newH } : n),
      }));
      return;
    }

    // Handle drag
    const id = this.dragNode();
    if (!id) return;
    const svgPt = this.toSvg(event);
    if (!svgPt) return;
    const offset = this.dragOffset();
    const x = Math.max(0, svgPt.x - offset.x);
    const y = Math.max(0, svgPt.y - offset.y);
    this.data.update(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === id ? { ...n, x, y } : n),
    }));
  }

  onMouseUp(): void {
    this.dragNode.set(null);
    this.resizingNode.set(null);
  }

  /* ── Resize ─────────────────────────────────────────── */
  startResize(event: MouseEvent, nodeId: string): void {
    event.stopPropagation();
    event.preventDefault();
    const node = this.getNode(nodeId);
    if (!node) return;
    const svgPt = this.toSvg(event);
    if (!svgPt) return;
    this.resizingNode.set(nodeId);
    this.resizeStart.set({ x: svgPt.x, y: svgPt.y, w: this.nodeW(node), h: this.nodeH(node) });
  }

  private toSvg(event: MouseEvent): { x: number; y: number } | null {
    const svg = this.svgEl()?.nativeElement;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  /** Shape path for different node types */
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
    // Action: rounded rect
    const r = 4;
    return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  }
}
