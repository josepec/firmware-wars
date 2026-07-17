import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  published: number;
  published_at: string | null;
  updated_at: string;
}

@Component({
  selector: 'app-post-list',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-5xl mx-auto">

      <div class="flex items-center justify-between mb-8">
        <div>
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN · PATCH_NOTES.LOG</div>
          <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
              style="font-family: 'Orbitron', monospace;">Noticias</h1>
        </div>
        <a routerLink="/admin/posts/new"
          class="px-4 py-2 text-[10px] tracking-[0.15em] uppercase
                 bg-green-500/10 border border-green-500/30 text-green-400
                 hover:bg-green-500/20 hover:border-green-400/50 transition-all">
          + Nueva
        </a>
      </div>

      @if (loading()) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">> LOADING...</div>
      } @else if (posts().length === 0) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">> No hay noticias creadas.</div>
      } @else {
        <div class="border border-green-500/15 divide-y divide-green-500/10">
          @for (p of posts(); track p.id) {
            <div class="flex items-center gap-3 px-4 py-3 hover:bg-green-500/3 transition-colors">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] tracking-wider text-green-300 font-bold truncate">{{ p.title }}</span>
                  @if (p.published) {
                    <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                                 border border-green-400/50 bg-green-500/10 text-green-300">Publicado</span>
                  } @else {
                    <span class="px-1.5 py-0.5 text-[8px] tracking-[0.2em] uppercase font-bold
                                 border border-yellow-400/50 bg-yellow-500/10 text-yellow-300">Borrador</span>
                  }
                </div>
                <div class="text-[9px] tracking-wider text-green-500/40 mt-0.5">
                  /noticias/{{ p.slug }} · {{ (p.published_at ?? p.updated_at) | date: 'dd/MM/yyyy HH:mm' }}
                </div>
              </div>
              @if (deleteConfirm() === p.id) {
                <button (click)="deletePost(p.id)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase bg-red-500/10 border border-red-500/30
                         text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">Si</button>
                <button (click)="deleteConfirm.set(null)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                         text-green-500/50 hover:text-green-400 transition-all cursor-pointer">No</button>
              } @else {
                <a [routerLink]="'/admin/posts/' + p.id"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                         text-green-500/50 hover:text-green-400 hover:border-green-500/40 transition-all">Ed</a>
                <button (click)="deleteConfirm.set(p.id)" type="button"
                  class="px-2 py-1 text-[8px] tracking-wider uppercase border border-red-500/15
                         text-red-500/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">X</button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PostList implements OnInit {
  private readonly auth = inject(AdminAuth);

  posts = signal<PostRow[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  ngOnInit() {
    this.loadPosts();
  }

  async loadPosts(): Promise<void> {
    this.loading.set(true);
    try {
      // Con el token, el endpoint incluye borradores
      const resp = await fetch(`${API_URL}/api/posts`, { headers: this.auth.authHeaders() });
      if (resp.ok) this.posts.set(await resp.json());
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  async deletePost(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/posts/${id}`, { method: 'DELETE', headers: this.auth.authHeaders() });
      this.posts.update(list => list.filter(p => p.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
