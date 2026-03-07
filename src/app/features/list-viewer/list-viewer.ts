import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface SavedBot {
  name: string;
  points: { constant: string; type: 'mejora' | 'desventaja' | null }[];
  attackFunctions: {
    v1: (string | null)[];
    v2: (string | null)[];
    v3: string | null;
  };
}

interface SavedList {
  id: string;
  programmer: string;
  bots: SavedBot[];
  created_at: string;
}

@Component({
  selector: 'app-list-viewer',
  imports: [RouterLink],
  templateUrl: './list-viewer.html',
})
export class ListViewer implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly list = signal<SavedList | null>(null);
  readonly linkCopied = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID no válido');
      this.loading.set(false);
      return;
    }
    this.loadList(id);
  }

  private async loadList(id: string): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/lists/${id}`);
      if (!resp.ok) {
        this.error.set(resp.status === 404 ? 'Lista no encontrada' : `Error ${resp.status}`);
        return;
      }
      this.list.set(await resp.json());
    } catch {
      this.error.set('Error de conexión');
    } finally {
      this.loading.set(false);
    }
  }

  copyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
  }

  shareWhatsApp(): void {
    const l = this.list();
    if (!l) return;
    const text = `${l.programmer} — Lista Firmware Wars`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + window.location.href)}`, '_blank');
  }
}
