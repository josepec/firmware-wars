import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-post-editor',
  imports: [FormsModule, RouterLink, MarkdownComponent],
  styleUrl: './post-editor.scss',
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <a routerLink="/admin/posts"
         class="text-[10px] tracking-[0.25em] text-green-500/50 hover:text-green-300 uppercase">← Noticias</a>

      <h1 class="mt-4 mb-6 text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
          style="font-family: 'Orbitron', monospace;">
        {{ editId ? 'Editar noticia' : 'Nueva noticia' }}
      </h1>

      <div class="space-y-4">
        <div>
          <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">Título</label>
          <input type="text" [ngModel]="title()" (ngModelChange)="onTitleChange($event)" maxlength="200"
            class="w-full px-3 py-2 text-sm bg-green-500/5 border border-green-500/20 text-green-300
                   focus:border-green-400/50 focus:outline-none" />
        </div>

        <div>
          <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">
            Slug <span class="text-green-500/30">(URL: /noticias/{{ slug() || '…' }})</span>
          </label>
          <input type="text" [ngModel]="slug()" (ngModelChange)="slugTouched = true; slug.set($event)" maxlength="80"
            class="w-full px-3 py-2 text-[11px] font-mono bg-green-500/5 border border-green-500/20 text-green-300
                   focus:border-green-400/50 focus:outline-none" />
          @if (editId && published()) {
            <div class="mt-1 text-[8px] tracking-wider text-yellow-500/60">
              ⚠ Cambiar el slug de una noticia publicada rompe los enlaces antiguos.
            </div>
          }
        </div>

        <div>
          <label class="block text-[9px] tracking-[0.2em] text-green-500/50 mb-1.5 uppercase">Imagen de cabecera (opcional)</label>
          @if (headerImage()) {
            <div class="flex items-start gap-3 mb-2">
              <img [src]="headerImage()" alt="cabecera" class="max-h-28 border border-green-500/20" />
              <button type="button" (click)="headerImage.set(null)"
                class="px-2 py-1 text-[8px] tracking-wider uppercase border border-red-500/20
                       text-red-400/60 hover:text-red-300 cursor-pointer">Quitar</button>
            </div>
          }
          <input type="file" accept="image/*" (change)="uploadFile($event)"
            class="block text-[10px] text-green-500/50 file:mr-3 file:px-3 file:py-1.5 file:text-[9px]
                   file:tracking-[0.15em] file:uppercase file:bg-green-500/10 file:border
                   file:border-green-500/30 file:text-green-400 file:cursor-pointer" />
          @if (uploading()) {
            <div class="mt-1 text-[9px] text-green-500/40 animate-pulse tracking-wider">> Subiendo…</div>
          }
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[9px] tracking-[0.2em] text-green-500/50 uppercase">
              Contenido (markdown — imágenes con /img &lt;url&gt;)
            </label>
            <button type="button" (click)="preview.set(!preview())"
              class="px-2 py-1 text-[8px] tracking-[0.15em] uppercase border cursor-pointer transition-all"
              [class]="preview()
                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                : 'border-green-500/20 text-green-500/50 hover:text-green-400'">
              {{ preview() ? 'Editar' : 'Preview' }}
            </button>
          </div>
          @if (preview()) {
            <div class="border border-cyan-500/20 bg-black/40 px-5 py-4 min-h-[16rem]">
              <markdown [data]="content()" [disableSanitizer]="true" />
            </div>
          } @else {
            <textarea [ngModel]="content()" (ngModelChange)="content.set($event)" rows="16"
              class="w-full px-3 py-2 text-[12px] font-mono leading-relaxed bg-green-500/5
                     border border-green-500/20 text-green-300 focus:border-green-400/50
                     focus:outline-none resize-y"></textarea>
          }
        </div>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" [ngModel]="published()" (ngModelChange)="published.set($event)"
                 class="accent-green-500" />
          <span class="text-[10px] tracking-[0.2em] text-green-400/80 uppercase">Publicada</span>
        </label>

        @if (error()) {
          <div class="text-[10px] tracking-[0.2em] text-red-400/80">> {{ error() }}</div>
        }

        <div class="flex items-center gap-3 pt-2">
          <button type="button" (click)="save()" [disabled]="saving()"
            class="px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase bg-green-500/10 border
                   border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-400/50
                   transition-all disabled:opacity-40 cursor-pointer">
            @if (saving()) { GUARDANDO... } @else { Guardar }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PostEditor implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  editId: string | null = null;
  slugTouched = false;

  title = signal('');
  slug = signal('');
  content = signal('');
  headerImage = signal<string | null>(null);
  published = signal(false);
  preview = signal(false);
  uploading = signal(false);
  saving = signal(false);
  error = signal('');

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/admin/scenarios']);
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.editId = id;
      this.slugTouched = true;
      try {
        const r = await fetch(`${API_URL}/api/posts/${id}`, { headers: this.auth.authHeaders() });
        if (r.ok) {
          const p = await r.json();
          this.title.set(p.title);
          this.slug.set(p.slug);
          this.content.set(p.content);
          this.headerImage.set(p.header_image);
          this.published.set(!!p.published);
        }
      } catch { /* ignore */ }
    }
  }

  onTitleChange(value: string): void {
    this.title.set(value);
    if (!this.slugTouched) this.slug.set(this.slugify(value));
  }

  private slugify(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
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
      const resp = await fetch(`${API_URL}/api/upload?prefix=blog`, {
        method: 'POST',
        headers: token ? { 'X-Admin-Token': token } : {},
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error ?? 'Upload failed');
      }
      const result = await resp.json();
      this.headerImage.set(`${API_URL}${result.url}`);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al subir el archivo.');
    }
    this.uploading.set(false);
    input.value = '';
  }

  async save(): Promise<void> {
    this.error.set('');
    if (!this.title().trim()) {
      this.error.set('El título es obligatorio.');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.slug())) {
      this.error.set('Slug inválido: solo minúsculas, números y guiones.');
      return;
    }
    this.saving.set(true);
    try {
      const payload = {
        title: this.title().trim(),
        slug: this.slug(),
        content: this.content(),
        headerImage: this.headerImage(),
        published: this.published(),
      };
      const url = this.editId ? `${API_URL}/api/posts/${this.editId}` : `${API_URL}/api/posts`;
      const resp = await fetch(url, {
        method: this.editId ? 'PUT' : 'POST',
        headers: this.auth.authHeaders(),
        body: JSON.stringify(payload),
      });
      if (resp.status === 409) {
        this.error.set('SLUG YA EXISTE — elige otro.');
      } else if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `API error ${resp.status}` }));
        this.error.set(err.error ?? `API error ${resp.status}`);
      } else {
        this.router.navigate(['/admin/posts']);
      }
    } catch (e) {
      this.error.set(String(e));
    }
    this.saving.set(false);
  }
}
