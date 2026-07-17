import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface Post {
  id: string;
  slug: string;
  title: string;
  content: string;
  header_image: string | null;
  published_at: string | null;
}

@Component({
  selector: 'app-news-post',
  imports: [RouterLink, DatePipe, MarkdownComponent],
  styleUrl: './news-post.scss',
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-3xl mx-auto">

      <a routerLink="/noticias"
         class="text-[10px] tracking-[0.25em] text-green-500/50 hover:text-green-300 uppercase">
        ← PATCH_NOTES.LOG
      </a>

      @if (loading()) {
        <div class="text-[10px] text-green-500/40 tracking-wider animate-pulse py-10">
          > CARGANDO ENTRADA...
        </div>
      } @else if (!post()) {
        <div class="mt-8 border border-red-500/30 bg-red-500/5 px-5 py-8 text-center
                    text-[10px] tracking-[0.2em] text-red-400/80">
          > ERROR 404: ENTRADA NO ENCONTRADA EN PATCH_NOTES.LOG
        </div>
      } @else {
        @let p = post()!;
        <article class="mt-6">
          @if (p.header_image) {
            <img [src]="p.header_image" [alt]="p.title"
                 class="w-full max-h-80 object-cover border border-green-500/15 mb-6" />
          }
          <div class="text-[9px] tracking-[0.25em] text-green-500/40 mb-2">
            {{ p.published_at | date: 'dd/MM/yyyy' }}
          </div>
          <h1 class="font-orbitron text-xl sm:text-2xl font-black tracking-tight
                     text-green-300 uppercase mb-6 pb-4 border-b border-green-500/15">
            {{ p.title }}
          </h1>
          <markdown [data]="p.content" [disableSanitizer]="true" />
        </article>
      }
    </div>
  `,
})
export class NewsPost implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly titleSvc = inject(Title);

  post = signal<Post | null>(null);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      try {
        const r = await fetch(`${API_URL}/api/posts/${slug}`);
        if (r.ok) {
          const p = (await r.json()) as Post;
          this.post.set(p);
          this.titleSvc.setTitle(`${p.title} · Firmware Wars`);
        }
      } catch { /* 404 */ }
    }
    this.loading.set(false);
  }
}
