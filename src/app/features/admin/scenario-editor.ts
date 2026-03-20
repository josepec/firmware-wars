import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';
import { HexMapEditor } from './hex-map-editor';
import { HexMapData, emptyMapData, DOT_COLORS, DotColor } from '../../shared/components/hex-map/hex-map.types';
import { classifyCode } from '../../shared/markdown/marked-extensions';

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
  numeroEscenario = signal(1);
  numeroTurnos = signal(0);
  numeroJugadores = signal(2);
  numeroBots = signal(3);
  ambientacion = signal('');
  objetivo = signal('');
  condicionDerrota = signal('');
  amenazaIds = signal<string[]>([]);
  linkedFunctions = signal<string[]>([]);
  availableFunctions = signal<{ id: string; name: string; type: string }[]>([]);
  amenazaCounts = signal<Record<string, number>>({});
  amenazaTurnos = signal<Record<string, number[]>>({});
  availableThreats = signal<{ id: string; name: string; imageUrl: string }[]>([]);
  despliegueMode = signal<'dots' | 'map'>('map');
  despliegueDots = signal<Record<number, DotColor>>({});
  hexMap = signal<HexMapData>(emptyMapData());

  readonly Math = Math;
  attackFunctions = computed(() => this.availableFunctions().filter(f => f.type !== 'passive'));
  passiveFunctions = computed(() => this.availableFunctions().filter(f => f.type === 'passive'));
  /** Threats selected for this scenario, to pass to hex-map-editor */
  selectedThreats = computed(() => {
    const ids = new Set(this.amenazaIds());
    return this.availableThreats().filter(t => ids.has(t.id));
  });
  /** Per-unit list for deployment config: "Sentry 1", "Sentry 2", etc. */
  threatUnits = computed(() => {
    const units: { threatId: string; name: string; index: number; label: string }[] = [];
    for (const t of this.selectedThreats()) {
      const count = this.amenazaCounts()[t.id] || 0;
      for (let i = 1; i <= count; i++) {
        units.push({ threatId: t.id, name: t.name, index: i, label: `${t.name} ${i}` });
      }
    }
    return units;
  });
  fnColor(name: string): string {
    const cls = classifyCode(name);
    const map: Record<string, string> = {
      'bs-fn': 'var(--bs-fn)', 'bs-kw': 'var(--bs-kw)', 'bs-var': 'var(--bs-var)',
      'bs-const': 'var(--bs-const)', 'bs-status': 'var(--bs-status)',
      'bs-phase': 'var(--bs-type)', 'bs-bug': 'var(--bs-status)',
    };
    return map[cls] || '';
  }
  readonly dotColors = DOT_COLORS;
  readonly playerNums = [1, 2, 3];
  readonly botNums = [1, 2];

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/scenarios']);
      return;
    }

    this.loadThreats();
    this.loadFunctions();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.loadScenario(id);
    } else {
      this.autoAssignNumero();
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
      this.numeroEscenario.set(d.numeroEscenario ?? 1);
      this.numeroTurnos.set(d.numeroTurnos ?? 0);
      this.numeroJugadores.set(d.numeroJugadores ?? 2);
      this.numeroBots.set(d.numeroBots ?? 3);
      this.ambientacion.set(d.ambientacion ?? '');
      this.objetivo.set(d.objetivo ?? '');
      this.condicionDerrota.set(d.condicionDerrota ?? '');
      this.amenazaIds.set(d.amenazaIds ?? []);
      this.linkedFunctions.set(d.linkedFunctions ?? []);
      this.amenazaCounts.set(d.amenazaCounts ?? {});
      this.amenazaTurnos.set(d.amenazaTurnos ?? {});
      this.despliegueMode.set(d.despliegueMode ?? 'map');
      this.despliegueDots.set(d.despliegueDots ?? {});
      if (d.hexMap) this.hexMap.set(d.hexMap);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }

  private async autoAssignNumero(): Promise<void> {
    try {
      const resp = await fetch(`${API_URL}/api/scenarios`);
      if (!resp.ok) return;
      const scenarios: { id: string }[] = await resp.json();
      // Load each scenario's data to find used numbers
      const usedNums = new Set<number>();
      await Promise.all(scenarios.map(async (s) => {
        const r = await fetch(`${API_URL}/api/scenarios/${s.id}`);
        if (r.ok) {
          const json = await r.json();
          const num = json.data?.numeroEscenario;
          if (num != null) usedNums.add(num);
        }
      }));
      let next = 1;
      while (usedNums.has(next)) next++;
      this.numeroEscenario.set(next);
    } catch { /* ignore */ }
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

  toggleFunction(fnId: string): void {
    this.linkedFunctions.update(list =>
      list.includes(fnId) ? list.filter(id => id !== fnId) : [...list, fnId]
    );
  }

  toggleThreat(id: string): void {
    const selected = this.amenazaIds().includes(id);
    this.amenazaIds.update(list =>
      selected ? list.filter(x => x !== id) : [...list, id]
    );
    if (selected) {
      // Remove deployments from map
      this.hexMap.update(d => ({
        ...d,
        deployments: d.deployments.filter(m => !(m.type === 'threat' && m.threatId === id)),
      }));
    } else {
      if (!this.amenazaCounts()[id]) {
        this.amenazaCounts.update(m => ({ ...m, [id]: 1 }));
      }
    }
  }

  setNumeroJugadores(n: number): void {
    const prev = this.numeroJugadores();
    this.numeroJugadores.set(n);
    if (n < prev) {
      this.hexMap.update(d => ({
        ...d,
        deployments: d.deployments.filter(m => !(m.type === 'player' && m.team && m.team > n)),
      }));
    }
  }

  setNumeroBots(n: number): void {
    const prev = this.numeroBots();
    this.numeroBots.set(n);
    if (n < prev) {
      // Keep only n markers per team
      this.hexMap.update(d => {
        const kept: Record<number, number> = {};
        const deployments = d.deployments.filter(m => {
          if (m.type !== 'player' || !m.team) return true;
          kept[m.team] = (kept[m.team] || 0) + 1;
          return kept[m.team] <= n;
        });
        return { ...d, deployments };
      });
    }
  }

  setDespliegueColor(player: number, color: DotColor): void {
    this.despliegueDots.update(d => ({ ...d, [player]: color }));
  }

  countRange(n: number): number[] { return Array.from({ length: n }, (_, i) => i + 1); }
  getAmenazaCount(id: string): number { return this.amenazaCounts()[id] || 0; }
  getUnitTurno(threatId: string, index: number): number {
    return this.amenazaTurnos()[threatId]?.[index - 1] ?? 0;
  }

  setAmenazaCount(id: string, count: number): void {
    const c = Math.max(0, Math.min(10, count));
    this.amenazaCounts.update(m => ({ ...m, [id]: c }));
    // Remove excess deployments if count was reduced
    const data = this.hexMap();
    const placed = data.deployments.filter(d => d.type === 'threat' && d.threatId === id);
    if (placed.length > c) {
      const keep = placed.slice(0, c);
      const keepSet = new Set(keep.map(d => `${d.q},${d.r}`));
      this.hexMap.set({
        ...data,
        deployments: data.deployments.filter(d =>
          !(d.type === 'threat' && d.threatId === id) || keepSet.has(`${d.q},${d.r}`)
        ),
      });
    }
  }

  setUnitTurno(threatId: string, index: number, turno: number): void {
    this.amenazaTurnos.update(m => {
      const arr = [...(m[threatId] || [])];
      arr[index - 1] = Math.max(0, turno);
      return { ...m, [threatId]: arr };
    });
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
        numeroEscenario: this.numeroEscenario(),
        numeroTurnos: this.numeroTurnos(),
        numeroJugadores: this.numeroJugadores(),
        numeroBots: this.numeroBots(),
        ambientacion: this.ambientacion(),
        objetivo: this.objetivo(),
        condicionDerrota: this.condicionDerrota(),
        amenazaIds: this.amenazaIds(),
        linkedFunctions: this.linkedFunctions(),
        amenazaCounts: this.amenazaCounts(),
        amenazaTurnos: this.amenazaTurnos(),
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

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || 'Save failed');
      }
      this.router.navigate(['/admin/scenarios']);
    } catch (e: any) {
      this.error.set(e?.message || 'Error al guardar.');
    }
    this.saving.set(false);
  }
}
