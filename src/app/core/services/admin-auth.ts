import { Injectable, signal } from '@angular/core';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Injectable({ providedIn: 'root' })
export class AdminAuth {
  readonly isAuthenticated = signal(!!sessionStorage.getItem('admin-token'));

  getToken(): string | null {
    return sessionStorage.getItem('admin-token');
  }

  async login(password: string): Promise<boolean> {
    try {
      const resp = await fetch(`${API_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json();
      if (data.valid && data.token) {
        sessionStorage.setItem('admin-token', data.token);
        this.isAuthenticated.set(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  logout(): void {
    sessionStorage.removeItem('admin-token');
    this.isAuthenticated.set(false);
  }

  /** Returns headers with admin token for API requests */
  authHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {}),
    };
  }
}
