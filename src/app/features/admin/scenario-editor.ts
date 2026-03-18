import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';
import { HexMapEditor } from './hex-map-editor';
import { HexMapData, emptyMapData, DOT_COLORS, DotColor } from '../../shared/components/hex-map/hex-map.types';

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
  numeroJugadores = signal(2);
  numeroBots = signal(3);
  ambientacion = signal('');
  objetivo = signal('');
  recompensa = signal('');
  penalizacion = signal('');
  amenazaIds = signal<string[]>([]);
  amenazaCounts = signal<Record<string, number>>({});
  availableThreats = signal<{ id: string; name: string; imageUrl: string }[]>([]);
  despliegueMode = signal<'dots' | 'map'>('map');
  despliegueDots = signal<Record<number, DotColor>>({});
  hexMap = signal<HexMapData>(emptyMapData());

  readonly Math = Math;
  /** Threats selected for this scenario, to pass to hex-map-editor */
  selectedThreats = computed(() => {
    const ids = new Set(this.amenazaIds());
    return this.availableThreats().filter(t => ids.has(t.id));
  });
  readonly dotColors = DOT_COLORS;
  readonly playerNums = [1, 2, 3];
  readonly botNums = [1, 2];

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/scenarios']);
      return;
    }

    this.loadThreats();
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
      this.numeroJugadores.set(d.numeroJugadores ?? 2);
      this.numeroBots.set(d.numeroBots ?? 3);
      this.ambientacion.set(d.ambientacion ?? '');
      this.objetivo.set(d.objetivo ?? '');
      this.recompensa.set(d.recompensa ?? '');
      this.penalizacion.set(d.penalizacion ?? '');
      this.amenazaIds.set(d.amenazaIds ?? []);
      this.amenazaCounts.set(d.amenazaCounts ?? {});
      this.despliegueMode.set(d.despliegueMode ?? 'map');
      this.despliegueDots.set(d.despliegueDots ?? {});
      if (d.hexMap) this.hexMap.set(d.hexMap);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }

  private async loadThreats(): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/threats`);
      if (resp.ok) {
        const threats = await resp.json();
        this.availableThreats.set(threats.map((t: any) => ({
          id: t.id, name: t.name, imageUrl: t.data?.imageUrl ?? '',
        })));
      }
    } catch { /* ignore */ }
  }

  toggleThreat(id: string): void {
    this.amenazaIds.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  setDespliegueColor(player: number, color: DotColor): void {
    this.despliegueDots.update(d => ({ ...d, [player]: color }));
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
        numeroJugadores: this.numeroJugadores(),
        numeroBots: this.numeroBots(),
        ambientacion: this.ambientacion(),
        objetivo: this.objetivo(),
        recompensa: this.recompensa(),
        penalizacion: this.penalizacion(),
        amenazaIds: this.amenazaIds(),
        amenazaCounts: this.amenazaCounts(),
        despliegueMode: this.despliegueMode(),
        despliegueDots: this.despliegueDots(),
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
      this.router.navigate(['/admin/scenarios']);
    } catch {
      this.error.set('Error al guardar.');
    }
    this.saving.set(false);
  }
}
