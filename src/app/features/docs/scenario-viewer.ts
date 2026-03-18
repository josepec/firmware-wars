import { Component, input, OnChanges, signal } from '@angular/core';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import { HexMapData, HexTypeDefinition } from '../../shared/components/hex-map/hex-map.types';

const API_URL = 'https://firmware-wars-api.josepec.eu';

const DOT_COLOR_NAMES: Record<string, string> = {
  green: 'Verde', blue: 'Azul', yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo',
};
const DOT_COLOR_HEX: Record<string, string> = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316', red: '#ef4444',
};

interface ThreatInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  count: number;
}

interface ScenarioData {
  numeroJugadores: number;
  numeroBots: number;
  ambientacion: string;
  objetivo: string;
  recompensa: string;
  penalizacion: string;
  amenazaIds: string[];
  amenazaCounts: Record<string, number>;
  despliegueMode: 'dots' | 'map';
  despliegueDots: Record<string, string>;
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
      <div class="scenario-view lg:flex lg:gap-8 lg:items-start">

        <!-- Info (izquierda en desktop) -->
        <div class="lg:flex-1 lg:min-w-0">

          <!-- Ficha tecnica -->
          @if (data()!.numeroJugadores) {
          <section class="mb-8">
            <h2 class="section-title">Ficha Técnica</h2>
            <div class="flex flex-wrap gap-4">
              <div class="stat-card">
                <span class="stat-value">{{ data()!.numeroJugadores }}</span>
                <span class="stat-label">{{ data()!.numeroJugadores === 1 ? 'Programador' : 'Programadores' }}</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ data()!.numeroBots || 3 }}</span>
                <span class="stat-label">{{ (data()!.numeroBots || 3) === 1 ? 'Bot' : 'Bots' }} / Programador</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">{{ data()!.hexMap.hexes.length || 0 }}</span>
                <span class="stat-label">Hexes</span>
              </div>
            </div>
          </section>
          }

          @if (data()!.ambientacion) {
          <section class="mb-8">
            <h2 class="section-title">Ambientación</h2>
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

          @if (data()!.penalizacion) {
          <section class="mb-8">
            <h2 class="section-title">Penalización</h2>
            <p class="section-text">{{ data()!.penalizacion }}</p>
          </section>
          }

          @if (threats().length > 0) {
          <section class="mb-8">
            <h2 class="section-title">Amenazas</h2>
            <div class="flex flex-col gap-5">
              @for (t of threats(); track t.id) {
              <div class="flex items-start gap-4 p-4 border border-green-500/10 bg-green-500/[0.02]">
                @if (t.imageUrl) {
                <div class="w-16 h-16 flex-shrink-0 border border-green-500/15 bg-black/40 flex items-center justify-center overflow-hidden">
                  <img [src]="t.imageUrl" [alt]="t.name" class="max-w-full max-h-full object-contain" />
                </div>
                }
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-green-300 text-sm tracking-wider font-bold">{{ t.name }}</span>
                    @if (t.count > 0) {
                    <span class="text-green-300 text-sm tracking-wider font-bold">×{{ t.count }}</span>
                    }
                  </div>
                  @if (t.description) {
                  <p class="section-text text-[0.8rem] mt-1 !leading-relaxed">{{ t.description }}</p>
                  }
                </div>
              </div>
              }
            </div>
          </section>
          }

        </div>

        <!-- Derecha en desktop: Mapa + Despliegue -->
        <div class="lg:w-[45%] lg:flex-shrink-0 lg:sticky lg:top-0">

          @if (data()!.hexMap && data()!.hexMap.hexes.length > 0) {
          <section class="mb-8">
            <h2 class="section-title">Entorno Digitalizado de Combate</h2>
            <div class="mt-4 p-4 border border-green-500/10 bg-[#111a14]">
              <app-hex-map [mapData]="data()!.hexMap" [size]="28" />
            </div>
          </section>
          }

          <!-- Hexes Especiales -->
          @if (specialHexTypes().length > 0) {
          <section class="mb-8">
            <h2 class="section-title">Hexes Especiales</h2>
            <div class="flex flex-col gap-4">
              @for (ht of specialHexTypes(); track ht.id) {
              <div class="flex items-start gap-3">
                <svg width="36" height="32" viewBox="-18 -16 36 32" class="flex-shrink-0">
                  <polygon
                    [attr.points]="miniHexPoints()"
                    [attr.fill]="ht.color"
                    [attr.stroke]="ht.borderColor"
                    stroke-width="2" />
                </svg>
                <div>
                  <span class="text-green-300 text-sm tracking-wider font-bold">{{ ht.name }}</span>
                  @if (ht.properties) {
                  <p class="section-text text-[0.8rem] mt-0.5 !leading-relaxed">{{ ht.properties }}</p>
                  }
                </div>
              </div>
              }
            </div>
          </section>
          }

          <!-- Despliegue -->
          <section>
            <h2 class="section-title">Despliegue</h2>
            @if (data()!.despliegueMode === 'dots' && data()!.despliegueDots) {
              <div class="flex flex-col gap-2">
                @for (entry of deployEntries(); track entry.player) {
                <div class="flex items-center gap-3">
                  <span class="w-3 h-3 rounded-full inline-block" [style.background]="dotHex(entry.color)"></span>
                  <span class="section-text">El Programador {{ entry.player }} desplegará sus Bots en los Hexes marcados con un punto {{ dotName(entry.color) }}.</span>
                </div>
                }
              </div>
            } @else {
              <div class="flex flex-col gap-1">
                @for (i of playerIndexes(); track i) {
                <p class="section-text">El Programador {{ i }} desplegará sus Bots en los marcadores P{{ i }} del Entorno Digitalizado de Combate.</p>
                }
              </div>
            }
          </section>

        </div>

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
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.75rem 1.25rem;
      border: 1px solid rgba(0, 255, 136, 0.12);
      background: rgba(0, 255, 136, 0.03);
      min-width: 5rem;
    }
    .stat-value {
      font-family: 'Orbitron', monospace;
      font-size: 1.4rem;
      font-weight: 700;
      color: #00ff88;
      text-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
    }
    .stat-label {
      font-size: 0.6rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgba(74, 222, 128, 0.45);
    }
  `],
})
export class ScenarioViewer implements OnChanges {
  readonly scenarioId = input.required<string>();

  loading = signal(false);
  error = signal('');
  data = signal<ScenarioData | null>(null);
  threats = signal<ThreatInfo[]>([]);

  private loadedId: string | null = null;

  dotName(color: string): string { return DOT_COLOR_NAMES[color] ?? color; }
  dotHex(color: string): string { return DOT_COLOR_HEX[color] ?? color; }

  specialHexTypes(): HexTypeDefinition[] {
    const types = this.data()?.hexMap?.hexTypes;
    if (!types) return [];
    return types.filter(t => t.id !== 'normal' && t.id !== 'obstacle');
  }

  miniHexPoints(): string {
    const s = 15;
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push(`${s * Math.cos(a)},${s * Math.sin(a)}`);
    }
    return pts.join(' ');
  }

  playerIndexes(): number[] {
    const n = this.data()?.numeroJugadores ?? 2;
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  deployEntries(): { player: string; color: string }[] {
    const d = this.data();
    if (!d?.despliegueDots) return [];
    const n = d.numeroJugadores ?? 2;
    return Object.entries(d.despliegueDots)
      .filter(([player]) => Number(player) <= n)
      .map(([player, color]) => ({ player, color }));
  }

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
      const [scenarioResp, typesResp, threatsResp] = await Promise.all([
        fetch(`${API_URL}/api/scenarios/${id}`),
        fetch(`${API_URL}/api/hex-types`),
        fetch(`${API_URL}/api/threats`),
      ]);
      if (!scenarioResp.ok) throw new Error('Not found');
      const json = await scenarioResp.json();
      const d: ScenarioData = json.data ?? null;

      // Merge fresh shared hex types into the map data
      if (d?.hexMap) {
        const sharedTypes: HexTypeDefinition[] = typesResp.ok ? await typesResp.json() : [];
        const builtIn = d.hexMap.hexTypes.filter(t => t.id === 'normal' || t.id === 'obstacle');
        const fresh = sharedTypes.map(t => ({ ...t, builtIn: false }));
        d.hexMap.hexTypes = [...builtIn, ...fresh];
      }

      // Resolve linked threats by ID
      if (d?.amenazaIds?.length && threatsResp.ok) {
        const allThreats: any[] = await threatsResp.json();
        const ids = new Set(d.amenazaIds);
        this.threats.set(allThreats
          .filter((t: any) => ids.has(t.id))
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description ?? '',
            imageUrl: t.data?.imageUrl ?? '',
            count: d.amenazaCounts?.[t.id] || 0,
          })));
      } else {
        this.threats.set([]);
      }

      this.data.set(d);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }
}
