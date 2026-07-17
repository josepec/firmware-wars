import { Injectable, inject, signal } from '@angular/core';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

/** Contador de consultas no leídas para el badge del nav admin.
 *  Lo carga admin-layout al autenticarse y lo actualiza la bandeja. */
@Injectable({ providedIn: 'root' })
export class ContactBadge {
  private readonly auth = inject(AdminAuth);

  readonly unread = signal(0);

  async refresh(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      const r = await fetch(`${API_URL}/api/contact`, { headers: this.auth.authHeaders() });
      if (r.ok) {
        const data = (await r.json()) as { unread: number };
        this.unread.set(data.unread ?? 0);
      }
    } catch { /* el badge es best-effort */ }
  }
}
