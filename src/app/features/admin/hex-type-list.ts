import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface SharedHexType {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  properties: string;
}

function autoBorder(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (v: number) => Math.max(0, Math.round(v * 0.55));
  return '#' + [darken(r), darken(g), darken(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

@Component({
  selector: 'app-hex-type-list',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Tipos de Hex</h1>
        </div>
      </div>

      <p class="text-[10px] tracking-[0.2em] text-green-500/35 mb-6">
        > Tipos compartidos entre todos los escenarios. "Normal" y "Obstaculo" son built-in.
      </p>

      @if (loading()) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse py-8">
        > LOADING...
      </div>
      }

      @if (error()) {
      <div class="mb-4 text-[10px] tracking-[0.2em] text-red-400/80 border border-red-500/20 px-4 py-2.5">
        > {{ error() }}
      </div>
      }

      <!-- Existing types -->
      @if (types().length > 0) {
      <ul class="border border-green-500/15 mb-6">
        @for (t of types(); track t.id) {
        <li class="flex items-center justify-between px-5 py-4
                   border-b border-green-500/10 last:border-b-0
                   hover:bg-green-500/3 transition-colors">
          <div class="flex items-center gap-3">
            <svg width="32" height="28" viewBox="-16 -14 32 28" class="flex-shrink-0">
              <polygon [attr.points]="miniHexPoints()" [attr.fill]="t.color" [attr.stroke]="t.borderColor" stroke-width="2" />
            </svg>
            <div>
              <div class="text-sm text-green-400 tracking-wider">{{ t.name }}</div>
              <div class="text-[9px] text-green-500/35 tracking-wider mt-0.5">
                ID: {{ t.id }}
                @if (t.properties) {
                  &middot; {{ t.properties }}
                }
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            @if (deleteConfirm() === t.id) {
              <span class="text-[9px] text-red-400/70 tracking-wider mr-1">CONFIRMAR?</span>
              <button (click)="deleteType(t.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       bg-red-500/10 border border-red-500/30 text-red-400
                       hover:bg-red-500/20 transition-all cursor-pointer">
                Si
              </button>
              <button (click)="deleteConfirm.set(null)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 transition-all cursor-pointer">
                No
              </button>
            } @else {
              <button (click)="startEdit(t)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-green-500/20 text-green-500/50
                       hover:text-green-400 hover:border-green-500/40 transition-all cursor-pointer">
                Editar
              </button>
              <button (click)="deleteConfirm.set(t.id)" type="button"
                class="px-3 py-1.5 text-[9px] tracking-wider uppercase
                       border border-red-500/15 text-red-500/40
                       hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">
                Borrar
              </button>
            }
          </div>
        </li>
        }
      </ul>
      }

      @if (!loading() && types().length === 0) {
      <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8 mb-6">
        > No hay tipos personalizados creados.
      </div>
      }

      <!-- Add / Edit form -->
      <div class="border border-green-500/15 bg-black/40 p-6">
        <div class="text-[10px] tracking-[0.2em] text-green-500/50 mb-4 uppercase">
          {{ editId() ? '// Editar Tipo' : '// Nuevo Tipo' }}
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap gap-4 items-end">
            <div class="flex flex-col gap-1">
              <label class="text-[9px] tracking-wider text-green-500/40 uppercase">Nombre</label>
              <input type="text" [ngModel]="formName()" (ngModelChange)="formName.set($event)"
                     placeholder="Ej: Agua, Fuego..."
                     class="px-3 py-2 text-sm bg-green-500/5 border border-green-500/20
                            text-green-300 focus:border-green-400/50 focus:outline-none tracking-wider w-40" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[9px] tracking-wider text-green-500/40 uppercase">Color</label>
              <div class="flex items-center gap-2">
                <input type="color" [ngModel]="formColor()" (ngModelChange)="formColor.set($event)"
                       class="w-10 h-10 cursor-pointer bg-transparent border border-green-500/20" />
                <svg width="32" height="28" viewBox="-16 -14 32 28" class="flex-shrink-0">
                  <polygon [attr.points]="miniHexPoints()" [attr.fill]="formColor()" [attr.stroke]="autoBorderPreview()" stroke-width="2" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Propiedades (texto libre) -->
          <div class="flex flex-col gap-1">
            <label class="text-[9px] tracking-wider text-green-500/40 uppercase">Propiedades</label>
            <textarea [ngModel]="formProps()" (ngModelChange)="formProps.set($event)"
                      class="px-3 py-2 text-sm bg-green-500/5 border border-green-500/20
                             text-green-300 focus:border-green-400/50 focus:outline-none tracking-wider resize-y"
                      rows="3" placeholder="Ej: Reduce velocidad 1. No se puede atacar."></textarea>
          </div>

          <div class="flex gap-2 pt-2">
            <button (click)="saveType()" type="button" [disabled]="saving()"
              class="px-5 py-2 text-[10px] tracking-[0.2em] uppercase
                     bg-green-500/15 border border-green-500/40 text-green-400
                     hover:bg-green-500/25 hover:border-green-400/60 transition-all
                     disabled:opacity-50 cursor-pointer">
              @if (saving()) { GUARDANDO... } @else { {{ editId() ? 'Actualizar' : 'Crear' }} }
            </button>
            @if (editId()) {
            <button (click)="cancelEdit()" type="button"
              class="px-5 py-2 text-[10px] tracking-[0.2em] uppercase
                     border border-green-500/15 text-green-500/40
                     hover:text-green-400 transition-all cursor-pointer">
              Cancelar
            </button>
            }
          </div>
        </div>
      </div>

    </div>
  `,
})
export class HexTypeList implements OnInit {
  private readonly auth = inject(AdminAuth);

  types = signal<SharedHexType[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  deleteConfirm = signal<string | null>(null);

  editId = signal<string | null>(null);
  formName = signal('');
  formColor = signal('#4488ff');
  formProps = signal('');

  ngOnInit(): void {
    this.loadTypes();
  }

  async loadTypes(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/hex-types`);
      if (resp.ok) this.types.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  miniHexPoints(): string {
    const s = 13;
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push(`${s * Math.cos(a)},${s * Math.sin(a)}`);
    }
    return pts.join(' ');
  }

  autoBorderPreview(): string {
    return autoBorder(this.formColor());
  }

  startEdit(t: SharedHexType): void {
    this.editId.set(t.id);
    this.formName.set(t.name);
    this.formColor.set(t.color);
    this.formProps.set(t.properties ?? '');
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.formName.set('');
    this.formColor.set('#4488ff');
    this.formProps.set('');
  }

  async saveType(): Promise<void> {
    const name = this.formName().trim();
    if (!name) { this.error.set('El nombre es obligatorio.'); return; }

    this.saving.set(true);
    this.error.set('');

    const color = this.formColor();
    const payload = {
      name,
      color,
      borderColor: autoBorder(color),
      properties: this.formProps().trim(),
    };

    try {
      const id = this.editId();
      const url = id ? `${API_URL}/api/hex-types/${id}` : `${API_URL}/api/hex-types`;
      const method = id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error('Save failed');
      this.cancelEdit();
      await this.loadTypes();
    } catch {
      this.error.set('Error al guardar.');
    }
    this.saving.set(false);
  }

  async deleteType(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/hex-types/${id}`, {
        method: 'DELETE',
        headers: this.auth.authHeaders(),
      });
      this.types.update(list => list.filter(t => t.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
