import { Component, computed, input, OnChanges, signal, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HexMap } from '../../shared/components/hex-map/hex-map';
import { HexMapData, HexTypeDefinition } from '../../shared/components/hex-map/hex-map.types';
import { classifyCode } from '../../shared/markdown/marked-extensions';

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
  turnos: number[];
}

interface ScenarioData {
  numeroEscenario: number;
  numeroTurnos: number;
  numeroJugadores: number;
  numeroBots: number;
  ambientacion: string;
  objetivo: string;
  condicionDerrota: string;
  amenazaIds: string[];
  amenazaCounts: Record<string, number>;
  amenazaTurnos: Record<string, number[]>;
  despliegueMode: 'dots' | 'map';
  despliegueDots: Record<string, string>;
  linkedFunctions: string[];
  hexMap: HexMapData;
}

@Component({
  selector: 'app-scenario-viewer',
  imports: [HexMap, RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (loading()) {
      <p class="text-green-500/40 text-[10px] tracking-widest animate-pulse">> LOADING...</p>
    } @else if (error()) {
      <p class="text-red-400/60 text-[10px] tracking-widest">> {{ error() }}</p>
    } @else if (data()) {
      <h1 class="scenario-main-title">{{ data()!.numeroEscenario < 10 ? '0' + data()!.numeroEscenario : data()!.numeroEscenario }} — {{ title() }}</h1>

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
                <span class="stat-value">{{ data()!.numeroTurnos === 0 ? '∞' : data()!.numeroTurnos }}</span>
                <span class="stat-label">Turnos</span>
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
            <p class="section-text" [innerHTML]="renderInlineCode(data()!.ambientacion)"></p>
          </section>
          }

          @if (data()!.objetivo) {
          <section class="mb-8">
            <h2 class="section-title">Objetivo</h2>
            <p class="section-text" [innerHTML]="renderInlineCode(data()!.objetivo)"></p>
          </section>
          }

          @if (data()!.condicionDerrota) {
          <section class="mb-8">
            <h2 class="section-title">Condición de Derrota</h2>
            <p class="section-text" [innerHTML]="renderInlineCode(data()!.condicionDerrota)"></p>
          </section>
          }

          @if (threats().length > 0) {
          <section class="mb-8">
            <h2 class="section-title">Amenazas</h2>
            <div class="flex flex-col gap-5">
              @for (t of threats(); track t.id) {
              <a [routerLink]="'/docs/escenarios/' + t.id"
                 class="flex items-start gap-4 p-4 border border-green-500/10 bg-green-500/[0.02]
                        hover:border-green-400/30 hover:bg-green-500/[0.05] transition-all cursor-pointer no-underline">
                @if (t.imageUrl) {
                <div class="w-16 h-16 flex-shrink-0 border border-green-500/15 bg-black/40 flex items-center justify-center overflow-hidden">
                  <img [src]="t.imageUrl" [alt]="t.name" class="max-w-full max-h-full object-contain" />
                </div>
                }
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm tracking-wider" style="color: #f0fdf4; font-weight: 600;">{{ t.name }}</span>
                    @if (t.count > 0) {
                    <span class="text-sm tracking-wider" style="color: #f0fdf4; font-weight: 600;">×{{ t.count }}</span>
                    }
                  </div>
                  @if (t.description) {
                  <p class="section-text text-[0.8rem] mt-1 !leading-relaxed">{{ t.description }}</p>
                  }
                </div>
              </a>
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
                  <span class="text-sm tracking-wider" style="color: #f0fdf4; font-weight: 600;">{{ ht.name }} ×{{ hexTypeCount(ht.id) }}</span>
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
            <div class="flex flex-col gap-1">
              @if (data()!.despliegueMode === 'dots' && data()!.despliegueDots) {
                @for (entry of deployEntries(); track entry.player) {
                <div class="flex items-center gap-3">
                  <span class="w-3 h-3 rounded-full inline-block" [style.background]="dotHex(entry.color)"></span>
                  <span class="section-text"><span style="color: #f0fdf4; font-weight: 600;">Programador {{ entry.player }}</span>: Bots en Hexes con punto {{ dotName(entry.color) }}.</span>
                </div>
                }
              } @else {
                @for (i of playerIndexes(); track i) {
                <p class="section-text"><span style="color: #f0fdf4; font-weight: 600;">Programador {{ i }}</span>: Bots en marcadores P{{ i }}.</p>
                }
              }
              @for (u of threatUnitList(); track u.label) {
                <p class="section-text"><span style="color: #f0fdf4; font-weight: 600;">{{ u.label }}</span>: {{ u.turno === 0 ? 'Al inicio de la partida' : 'Al inicio del turno ' + u.turno }}, en marcador {{ u.marker }}.</p>
              }
            </div>
          </section>

        </div>

      </div>

      @if (scenarioFunctions().length > 0) {
      <section class="mt-8">
        <h2 class="section-title">Funciones de Escenario</h2>
        <p class="section-text mb-4">Las siguientes Funciones están disponibles exclusivamente durante este Escenario. Pueden asignarse a cualquier ranura de Función de los Bots.<br>Al finalizar el Escenario, se pierden.</p>
        <div>
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
              @for (fn of attackScenarioFunctions(); track fn.name) {
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
        </div>
        @if (passiveScenarioFunctions().length > 0) {
        <div class="mt-4">
          <table class="fn-table">
            <thead>
              <tr>
                <th style="width: 1%; white-space: nowrap;">Función (Pasiva)</th>
                <th style="text-align: left;">Efectos</th>
              </tr>
            </thead>
            <tbody>
              @for (fn of passiveScenarioFunctions(); track fn.name) {
              <tr>
                <td><code [class]="codeClass(fn.name)">{{ fn.name }}</code></td>
                <td [innerHTML]="renderInlineCode(fn.effects)"></td>
              </tr>
              }
            </tbody>
          </table>
        </div>
        }
      </section>
      }

    }
  `,
  styles: [`
    app-scenario-viewer .scenario-main-title {
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
    app-scenario-viewer .section-title {
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
    app-scenario-viewer .section-text {
      color: rgba(74, 222, 128, 0.8);
      line-height: 1.85;
      font-size: 0.9rem;
      white-space: pre-line;
    }
    app-scenario-viewer .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.75rem 1.25rem;
      border: 1px solid rgba(0, 255, 136, 0.12);
      background: rgba(0, 255, 136, 0.03);
      min-width: 5rem;
    }
    app-scenario-viewer .stat-value {
      font-family: 'Orbitron', monospace;
      font-size: 1.4rem;
      font-weight: 700;
      color: #00ff88;
      text-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
    }
    app-scenario-viewer .fn-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      border: 1px solid rgba(0, 255, 136, 0.12);
    }
    app-scenario-viewer .fn-table thead {
      background: rgba(0, 255, 136, 0.04);
      border-bottom: 1px solid rgba(0, 255, 136, 0.25);
    }
    app-scenario-viewer .fn-table th {
      font-family: 'Orbitron', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(0, 255, 136, 0.65);
      padding: 0.65rem 1rem;
      text-align: left;
      white-space: nowrap;
    }
    app-scenario-viewer .fn-table tbody tr {
      border-bottom: 1px solid rgba(0, 255, 136, 0.07);
      transition: background 0.15s;
    }
    app-scenario-viewer .fn-table tbody tr:last-child { border-bottom: none; }
    app-scenario-viewer .fn-table tbody tr:hover { background: rgba(0, 255, 136, 0.03); }
    app-scenario-viewer .fn-table td {
      color: rgba(74, 222, 128, 0.75);
      padding: 0.6rem 1rem;
      vertical-align: top;
      line-height: 1.6;
    }
    app-scenario-viewer .fn-table td:not(:last-child) {
      white-space: nowrap;
    }
    app-scenario-viewer .fn-table code {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 0.85em;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.07);
      border: 1px solid rgba(0, 255, 136, 0.22);
      padding: 0.1em 0.45em;
      border-radius: 2px;
    }
    app-scenario-viewer .fn-table code.bs-kw    { color: var(--bs-kw);    background: color-mix(in srgb, var(--bs-kw)    7%, transparent); border-color: color-mix(in srgb, var(--bs-kw)    22%, transparent); }
    app-scenario-viewer .fn-table code.bs-fn    { color: var(--bs-fn);    background: color-mix(in srgb, var(--bs-fn)    7%, transparent); border-color: color-mix(in srgb, var(--bs-fn)    22%, transparent); }
    app-scenario-viewer .fn-table code.bs-var   { color: var(--bs-var);   background: color-mix(in srgb, var(--bs-var)   7%, transparent); border-color: color-mix(in srgb, var(--bs-var)   22%, transparent); }
    app-scenario-viewer .fn-table code.bs-const  { color: var(--bs-const);  background: color-mix(in srgb, var(--bs-const)  7%, transparent); border-color: color-mix(in srgb, var(--bs-const)  22%, transparent); }
    app-scenario-viewer .fn-table code.bs-status { color: var(--bs-status); background: color-mix(in srgb, var(--bs-status) 7%, transparent); border-color: color-mix(in srgb, var(--bs-status) 22%, transparent); }
    app-scenario-viewer .fn-table code.bs-bug    { color: var(--bs-status); background: transparent; border: none; padding: 0; }
    app-scenario-viewer .fn-table code.bs-phase  { color: var(--bs-type);   background: color-mix(in srgb, var(--bs-type)   7%, transparent); border-color: color-mix(in srgb, var(--bs-type)   22%, transparent); }
    app-scenario-viewer .section-text code {
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 0.85em;
      color: #00ff88;
      background: rgba(0, 255, 136, 0.07);
      border: 1px solid rgba(0, 255, 136, 0.22);
      padding: 0.1em 0.45em;
      border-radius: 2px;
    }
    app-scenario-viewer .section-text code.bs-kw    { color: var(--bs-kw);    background: color-mix(in srgb, var(--bs-kw)    7%, transparent); border-color: color-mix(in srgb, var(--bs-kw)    22%, transparent); }
    app-scenario-viewer .section-text code.bs-fn    { color: var(--bs-fn);    background: color-mix(in srgb, var(--bs-fn)    7%, transparent); border-color: color-mix(in srgb, var(--bs-fn)    22%, transparent); }
    app-scenario-viewer .section-text code.bs-var   { color: var(--bs-var);   background: color-mix(in srgb, var(--bs-var)   7%, transparent); border-color: color-mix(in srgb, var(--bs-var)   22%, transparent); }
    app-scenario-viewer .section-text code.bs-const  { color: var(--bs-const);  background: color-mix(in srgb, var(--bs-const)  7%, transparent); border-color: color-mix(in srgb, var(--bs-const)  22%, transparent); }
    app-scenario-viewer .section-text code.bs-status { color: var(--bs-status); background: color-mix(in srgb, var(--bs-status) 7%, transparent); border-color: color-mix(in srgb, var(--bs-status) 22%, transparent); }
    app-scenario-viewer .section-text code.bs-bug    { color: var(--bs-status); background: transparent; border: none; padding: 0; }
    app-scenario-viewer .section-text code.bs-phase  { color: var(--bs-type);   background: color-mix(in srgb, var(--bs-type)   7%, transparent); border-color: color-mix(in srgb, var(--bs-type)   22%, transparent); }
    app-scenario-viewer .section-text strong {
      color: #f0fdf4;
      font-weight: 600;
    }
    app-scenario-viewer .stat-label {
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
  title = signal('');
  data = signal<ScenarioData | null>(null);
  threats = signal<ThreatInfo[]>([]);
  scenarioFunctions = signal<{ name: string; type: string; version: string; range: string; damage: string; energy: string; cost: string; effects: string }[]>([]);

  private loadedId: string | null = null;

  attackScenarioFunctions = computed(() => this.scenarioFunctions().filter(f => f.type !== 'passive'));
  passiveScenarioFunctions = computed(() => this.scenarioFunctions().filter(f => f.type === 'passive'));

  codeClass(text: string): string { return classifyCode(text) || ''; }
  hexTypeCount(typeId: string): number {
    return this.data()?.hexMap?.hexes?.filter(h => h.typeId === typeId).length ?? 0;
  }
  renderInlineCode(text: string): string {
    const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe(text)
      .replace(/`([^`]+)`/g, (_, code) => {
        const cls = classifyCode(code);
        return `<code${cls ? ` class="${cls}"` : ''}>${code}</code>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
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

  threatUnitList(): { label: string; marker: string; turno: number }[] {
    const units: { label: string; marker: string; turno: number }[] = [];
    for (const t of this.threats()) {
      const prefix = t.name.substring(0, 3).toUpperCase();
      for (let i = 1; i <= t.count; i++) {
        units.push({ label: `${t.name} ${i}`, marker: `${prefix}${i}`, turno: t.turnos[i - 1] ?? 0 });
      }
    }
    return units;
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
      const [scenarioResp, typesResp, threatsResp, functionsResp] = await Promise.all([
        fetch(`${API_URL}/api/scenarios/${id}`),
        fetch(`${API_URL}/api/hex-types`),
        fetch(`${API_URL}/api/threats`),
        fetch(`${API_URL}/api/functions/admin`),
      ]);
      if (!scenarioResp.ok) throw new Error('Not found');
      const json = await scenarioResp.json();
      this.title.set(json.title ?? '');
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
            turnos: d.amenazaTurnos?.[t.id] || [],
          })));
      } else {
        this.threats.set([]);
      }

      // Resolve linked functions by ID
      if (d?.linkedFunctions?.length && functionsResp.ok) {
        const allFns: any[] = await functionsResp.json();
        const fnIds = new Set(d.linkedFunctions);
        this.scenarioFunctions.set(allFns
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
        this.scenarioFunctions.set([]);
      }

      this.data.set(d);
    } catch {
      this.error.set('Error al cargar el escenario.');
    }
    this.loading.set(false);
  }
}
