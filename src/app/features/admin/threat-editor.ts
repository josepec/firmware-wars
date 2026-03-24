import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';
import { FlowchartEditor } from './flowchart-editor';
import { classifyCode } from '../../shared/markdown/marked-extensions';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-threat-editor',
  imports: [FormsModule, RouterLink, FlowchartEditor],
  templateUrl: './threat-editor.html',
  styleUrl: './threat-editor.scss',
})
export class ThreatEditor implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  editId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  uploading = signal(false);
  error = signal('');

  name = signal('');
  description = signal('');
  imageUrl = signal('');
  linkedFunctions = signal<string[]>([]);

  /** Available functions for linking */
  availableFunctions = signal<{ id: string; name: string; type: string }[]>([]);
  attackFunctions = computed(() => this.availableFunctions().filter(f => f.type !== 'passive'));
  passiveFunctions = computed(() => this.availableFunctions().filter(f => f.type === 'passive'));

  /** Flowchart data */
  flowchart = signal<{ nodes: FlowNode[]; connections: FlowConnection[] }>({
    nodes: [],
    connections: [],
  });

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/threats']);
      return;
    }
    this.loadFunctions();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.loadThreat(id);
    }
  }

  private async loadFunctions(): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/functions/admin`);
      if (resp.ok) {
        const fns = await resp.json();
        this.availableFunctions.set(fns.map((f: any) => ({
          id: f.id, name: f.func_name, type: f.func_type ?? 'attack',
        })));
      }
    } catch { /* ignore */ }
  }

  private async loadThreat(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/threats/${id}`);
      if (!resp.ok) throw new Error('Not found');
      const threat = await resp.json();
      this.name.set(threat.name ?? '');
      this.description.set(threat.description ?? '');
      const data = threat.data ?? {};
      this.imageUrl.set(data.imageUrl ?? '');
      this.linkedFunctions.set(data.linkedFunctions ?? []);
      if (data.flowchart) this.flowchart.set(data.flowchart);
    } catch {
      this.error.set('Error al cargar la amenaza.');
    }
    this.loading.set(false);
  }

  toggleFunction(fnId: string): void {
    this.linkedFunctions.update(list =>
      list.includes(fnId) ? list.filter(id => id !== fnId) : [...list, fnId]
    );
  }

  fnColor(name: string): string {
    const cls = classifyCode(name);
    const map: Record<string, string> = {
      'bs-fn': 'var(--bs-fn)', 'bs-kw': 'var(--bs-kw)', 'bs-var': 'var(--bs-var)',
      'bs-const': 'var(--bs-const)', 'bs-status': 'var(--bs-status)',
      'bs-bug': 'var(--bs-status)',
      'bs-type': 'var(--bs-type)', 'bs-str': 'var(--bs-str)',
    };
    return map[cls] ?? '';
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = this.auth.getToken();
      const resp = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { 'X-Admin-Token': token } : {},
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error ?? 'Upload failed');
      }

      const result = await resp.json();
      this.imageUrl.set(`${API_URL}${result.url}`);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al subir el archivo.');
    }

    this.uploading.set(false);
    input.value = '';
  }

  async save(): Promise<void> {
    if (!this.name().trim()) {
      this.error.set('El nombre es obligatorio.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      name: this.name().trim(),
      description: this.description().trim(),
      data: {
        imageUrl: this.imageUrl().trim(),
        linkedFunctions: this.linkedFunctions(),
        flowchart: this.flowchart(),
      },
    };

    try {
      const id = this.editId();
      const url = id ? `${API_URL}/api/threats/${id}` : `${API_URL}/api/threats`;
      const method = id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Save failed');
      this.router.navigate(['/admin/threats']);
    } catch {
      this.error.set('Error al guardar.');
    }
    this.saving.set(false);
  }
}

export interface FlowNode {
  id: string;
  type: 'start' | 'action' | 'condition' | 'end';
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface FlowConnection {
  from: string;
  to: string;
  label?: string;
}
