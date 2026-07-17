import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminAuth } from '../../core/services/admin-auth';
import { ContactBadge } from './contact-badge.service';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ContactMessage {
  id: string;
  name: string;
  email: string | null;
  message: string;
  read: number;
  created_at: string;
}

@Component({
  selector: 'app-message-list',
  imports: [DatePipe],
  template: `
    <div class="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      <div class="mb-8">
        <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-1">// ADMIN · HELPDESK.SYS</div>
        <h1 class="text-lg tracking-[0.15em] text-green-400 font-bold uppercase"
            style="font-family: 'Orbitron', monospace;">
          Consultas
          @if (unreadCount() > 0) {
            <span class="ml-2 px-2 py-0.5 text-[10px] border border-orange-400/60 bg-orange-500/15 text-orange-300">
              {{ unreadCount() }} sin leer
            </span>
          }
        </h1>
      </div>

      @if (loading()) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/40 animate-pulse">> LOADING...</div>
      } @else if (messages().length === 0) {
        <div class="text-[10px] tracking-[0.2em] text-green-500/35 py-8">> Bandeja vacía. Ni un ping.</div>
      } @else {
        <div class="border border-green-500/15 divide-y divide-green-500/10">
          @for (m of messages(); track m.id) {
            <div>
              <button type="button" (click)="toggle(m)"
                class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer
                       hover:bg-green-500/3 transition-colors">
                <span class="w-2 h-2 rounded-full shrink-0"
                      [class.bg-orange-400]="!m.read" [class.bg-green-500/20]="m.read"></span>
                <span class="flex-1 min-w-0 truncate text-[11px] tracking-wider"
                      [class.text-green-200]="!m.read" [class.font-bold]="!m.read"
                      [class.text-green-500/70]="m.read">
                  {{ m.name }} — {{ m.message }}
                </span>
                <span class="text-[9px] text-green-500/40 shrink-0">{{ m.created_at | date: 'dd/MM HH:mm' }}</span>
              </button>
              @if (openId() === m.id) {
                <div class="px-6 pb-4 pt-1 border-t border-green-500/10 space-y-2">
                  <div class="text-[9px] tracking-wider text-green-500/50">
                    ALIAS: <span class="text-green-300">{{ m.name }}</span>
                    · CANAL: <span class="text-green-300">{{ m.email ?? '(no indicado)' }}</span>
                    · {{ m.created_at | date: 'dd/MM/yyyy HH:mm' }}
                  </div>
                  <!-- Texto plano SIEMPRE: es input de usuario, jamás markdown/HTML -->
                  <p class="text-[12px] leading-relaxed text-green-300/85 whitespace-pre-wrap">{{ m.message }}</p>
                  <div class="flex items-center gap-2 pt-1">
                    @if (deleteConfirm() === m.id) {
                      <button (click)="deleteMessage(m.id)" type="button"
                        class="px-2 py-1 text-[8px] tracking-wider uppercase bg-red-500/10 border border-red-500/30
                               text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">Borrar sí</button>
                      <button (click)="deleteConfirm.set(null)" type="button"
                        class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                               text-green-500/50 hover:text-green-400 transition-all cursor-pointer">No</button>
                    } @else {
                      <button (click)="deleteConfirm.set(m.id)" type="button"
                        class="px-2 py-1 text-[8px] tracking-wider uppercase border border-red-500/15
                               text-red-500/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">Borrar</button>
                      @if (m.read) {
                        <button (click)="markRead(m, false)" type="button"
                          class="px-2 py-1 text-[8px] tracking-wider uppercase border border-green-500/20
                                 text-green-500/50 hover:text-green-400 transition-all cursor-pointer">Marcar no leída</button>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MessageList implements OnInit {
  private readonly auth = inject(AdminAuth);
  private readonly badge = inject(ContactBadge);

  messages = signal<ContactMessage[]>([]);
  loading = signal(false);
  openId = signal<string | null>(null);
  deleteConfirm = signal<string | null>(null);

  unreadCount(): number {
    return this.messages().filter(m => !m.read).length;
  }

  ngOnInit() {
    this.loadMessages();
  }

  async loadMessages(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/contact`, { headers: this.auth.authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        this.messages.set(data.messages ?? []);
        this.badge.unread.set(data.unread ?? 0);
      }
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  toggle(m: ContactMessage): void {
    this.openId.update(cur => (cur === m.id ? null : m.id));
    if (this.openId() === m.id && !m.read) void this.markRead(m, true);
  }

  async markRead(m: ContactMessage, read: boolean): Promise<void> {
    try {
      await fetch(`${API_URL}/api/contact/${m.id}/read`, {
        method: 'PUT',
        headers: this.auth.authHeaders(),
        body: JSON.stringify({ read }),
      });
      this.messages.update(list => list.map(x => x.id === m.id ? { ...x, read: read ? 1 : 0 } : x));
      this.badge.unread.set(this.unreadCount());
    } catch { /* ignore */ }
  }

  async deleteMessage(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/contact/${id}`, { method: 'DELETE', headers: this.auth.authHeaders() });
      this.messages.update(list => list.filter(m => m.id !== id));
      this.badge.unread.set(this.unreadCount());
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
