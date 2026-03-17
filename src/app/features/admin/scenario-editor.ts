import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';
import { HexMapEditor } from './hex-map-editor';
import { HexMapData, emptyMapData } from '../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-scenario-editor',
  imports: [FormsModule, RouterLink, HexMapEditor],
  templateUrl: './scenario-editor.html',
  styleUrl: './scenario-editor.scss',
})
export class ScenarioEditor implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  editId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  title = signal('');
  ambientacion = signal('');
  objetivo = signal('');
  recompensa = signal('');
  amenazas = signal('');
  hexMap = signal<HexMapData>(emptyMapData());

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.loadScenario(id);
    }
  }

  private async loadScenario(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/scenarios/${id}`);
      if (!resp.ok) throw new Error('Not found');
      const scenario = await resp.json();
      this.title.set(scenario.title ?? '');
      const d = scenario.data ?? {};
      this.ambientacion.set(d.ambientacion ?? '');
      this.objetivo.set(d.objetivo ?? '');
      this.recompensa.set(d.recompensa ?? '');
      this.amenazas.set(d.amenazas ?? '');
      if (d.hexMap) this.hexMap.set(d.hexMap);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }

  async save(): Promise<void> {
    if (!this.title().trim()) {
      this.error.set('El titulo es obligatorio.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      title: this.title().trim(),
      data: {
        ambientacion: this.ambientacion(),
        objetivo: this.objetivo(),
        recompensa: this.recompensa(),
        amenazas: this.amenazas(),
        hexMap: this.hexMap(),
      },
    };

    try {
      const id = this.editId();
      const url = id ? `${API_URL}/api/scenarios/${id}` : `${API_URL}/api/scenarios`;
      const method = id ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error('Save failed');
      this.router.navigate(['/admin']);
    } catch {
      this.error.set('Error al guardar.');
    }
    this.saving.set(false);
  }
}
