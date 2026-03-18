import { Component, model, signal, computed, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FlowNode, FlowConnection } from './threat-editor';

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
  readonly dragNode = signal<string | null>(null);
  readonly dragOffset = signal({ x: 0, y: 0 });

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

  readonly NODE_W = 160;
  readonly NODE_H = 50;

  svgWidth = computed(() => {
    const nodes = this.data().nodes;
    if (nodes.length === 0) return 800;
    return Math.max(800, ...nodes.map(n => n.x + this.NODE_W + 40));
  });

  svgHeight = computed(() => {
    const nodes = this.data().nodes;
    if (nodes.length === 0) return 400;
    return Math.max(400, ...nodes.map(n => n.y + this.NODE_H + 40));
  });

  getNode(id: string): FlowNode | undefined {
    return this.data().nodes.find(n => n.id === id);
  }

  nodeColor(type: FlowNode['type']): string {
    return this.nodeTypes.find(t => t.id === type)?.color ?? '#666';
  }

  addNode(): void {
    const label = this.newNodeLabel().trim();
    if (!label) return;
    const id = 'n' + Date.now();
    const nodes = this.data().nodes;
    const x = 40 + (nodes.length % 4) * 200;
    const y = 40 + Math.floor(nodes.length / 4) * 100;
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
        nodes: d.nodes.map(n => n.id === id ? { ...n, label } : n),
      }));
    }
    this.editingNode.set(null);
  }

  /** Connection mode: click first node, then second */
  startConnect(id: string): void {
    const from = this.connectingFrom();
    if (!from) {
      this.connectingFrom.set(id);
      return;
    }
    if (from === id) {
      this.connectingFrom.set(null);
      return;
    }
    // Check if connection already exists
    const exists = this.data().connections.some(c => c.from === from && c.to === id);
    if (!exists) {
      this.data.update(d => ({
        ...d,
        connections: [...d.connections, { from, to: id }],
      }));
    }
    this.connectingFrom.set(null);
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

  /** Get path for a connection arrow */
  connPath(c: FlowConnection): string {
    const from = this.getNode(c.from);
    const to = this.getNode(c.to);
    if (!from || !to) return '';

    const fx = from.x + this.NODE_W / 2;
    const fy = from.y + this.NODE_H;
    const tx = to.x + this.NODE_W / 2;
    const ty = to.y;

    const dy = ty - fy;
    const cy1 = fy + dy * 0.4;
    const cy2 = ty - dy * 0.4;

    return `M ${fx} ${fy} C ${fx} ${cy1}, ${tx} ${cy2}, ${tx} ${ty}`;
  }

  /** Midpoint of connection for label placement */
  connMid(c: FlowConnection): { x: number; y: number } {
    const from = this.getNode(c.from);
    const to = this.getNode(c.to);
    if (!from || !to) return { x: 0, y: 0 };
    return {
      x: (from.x + to.x) / 2 + this.NODE_W / 2,
      y: (from.y + this.NODE_H + to.y) / 2,
    };
  }

  /* ── Drag & drop ────────────────────────────────────── */
  onMouseDown(event: MouseEvent, nodeId: string): void {
    // Don't drag when editing
    if (this.editingNode() === nodeId) return;
    const node = this.getNode(nodeId);
    if (!node) return;

    const svg = this.svgEl()?.nativeElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    this.dragNode.set(nodeId);
    this.dragOffset.set({ x: svgPt.x - node.x, y: svgPt.y - node.y });
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent): void {
    const id = this.dragNode();
    if (!id) return;

    const svg = this.svgEl()?.nativeElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

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
  }

  /** Shape path for different node types */
  nodePath(node: FlowNode): string {
    const w = this.NODE_W;
    const h = this.NODE_H;
    if (node.type === 'condition') {
      // Diamond
      return `M ${w/2} 0 L ${w} ${h/2} L ${w/2} ${h} L 0 ${h/2} Z`;
    }
    if (node.type === 'start' || node.type === 'end') {
      // Rounded rect (stadium shape)
      const r = h / 2;
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }
    // Action: rect
    return `M 0 0 H ${w} V ${h} H 0 Z`;
  }
}
