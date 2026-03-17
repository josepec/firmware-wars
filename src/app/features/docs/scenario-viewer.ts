import { Component, input, OnChanges, signal } from '@angular/core';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import { HexMapData, emptyMapData } from '../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ScenarioData {
  ambientacion: string;
  objetivo: string;
  recompensa: string;
  amenazas: string;
  hexMap: HexMapData;
}

@Component({
  selector: 'app-scenario-viewer',
  imports: [HexMap],
  template: `
    @if (loading()) {
      <p class="text-green-500/40 text-[10px] tracking-widest animate-pulse">> LOADING...</p>
    } @else if (error()) {
      <p class="text-red-400/60 text-[10px] tracking-widest">> {{ error() }}</p>
    } @else if (data()) {
      <div class="scenario-view">

        @if (data()!.ambientacion) {
        <section class="mb-8">
          <h2 class="section-title">Ambientacion</h2>
          <p class="section-text">{{ data()!.ambientacion }}</p>
        </section>
        }

        @if (data()!.objetivo) {
        <section class="mb-8">
          <h2 class="section-title">Objetivo</h2>
          <p class="section-text">{{ data()!.objetivo }}</p>
        </section>
        }

        @if (data()!.recompensa) {
        <section class="mb-8">
          <h2 class="section-title">Recompensa</h2>
          <p class="section-text">{{ data()!.recompensa }}</p>
        </section>
        }

        @if (data()!.amenazas) {
        <section class="mb-8">
          <h2 class="section-title">Amenazas</h2>
          <p class="section-text">{{ data()!.amenazas }}</p>
        </section>
        }

        @if (data()!.hexMap && data()!.hexMap.hexes.length > 0) {
        <section>
          <h2 class="section-title">Entorno Digitalizado de Combate</h2>
          <div class="mt-4 p-4 border border-green-500/10 bg-[#0a0f0c]">
            <app-hex-map [mapData]="data()!.hexMap" [size]="28" />
          </div>
        </section>
        }

      </div>
    }
  `,
  styles: [`
    .section-title {
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
    .section-text {
      color: rgba(74, 222, 128, 0.8);
      line-height: 1.85;
      font-size: 0.9rem;
      white-space: pre-line;
    }
  `],
})
export class ScenarioViewer implements OnChanges {
  readonly scenarioId = input.required<string>();

  loading = signal(false);
  error = signal('');
  data = signal<ScenarioData | null>(null);

  private loadedId: string | null = null;

  ngOnChanges(): void {
    const id = this.scenarioId();
    if (id && id !== this.loadedId) {
      this.loadedId = id;
      this.load(id);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const resp = await fetch(`${API_URL}/api/scenarios/${id}`);
      if (!resp.ok) throw new Error('Not found');
      const json = await resp.json();
      this.data.set(json.data ?? null);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }
}
