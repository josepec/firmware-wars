import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (!auth.isAuthenticated()) {
      <!-- Login ──────────────────────────────────────────── -->
      <div class="flex items-center justify-center min-h-[60vh] p-6">
        <div class="w-full max-w-sm border border-green-500/20 bg-black/60 p-8">
          <div class="text-[10px] tracking-[0.3em] text-green-500/50 mb-6">// ADMIN ACCESS</div>

          <form (submit)="$event.preventDefault(); onLogin()">
            <label class="block text-[10px] tracking-[0.2em] text-green-500/40 mb-2 uppercase">Password</label>
            <input type="password" autocomplete="current-password"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
              class="w-full px-4 py-2.5 text-sm bg-green-500/5 border border-green-500/20
                     text-green-300 focus:border-green-400/50 focus:outline-none tracking-wider" />

            @if (loginError()) {
            <div class="mt-3 text-[10px] tracking-[0.2em] text-red-400/80">> ACCESS DENIED</div>
            }

            <button type="submit" [disabled]="loginLoading()"
              class="mt-5 w-full py-2.5 text-[10px] tracking-[0.2em] uppercase
                     bg-green-500/10 border border-green-500/30 text-green-400
                     hover:bg-green-500/20 hover:border-green-400/50 transition-all
                     disabled:opacity-50 cursor-pointer">
              @if (loginLoading()) { VERIFYING... } @else { AUTHENTICATE }
            </button>
          </form>
        </div>
      </div>
    } @else {
      <!-- Admin sub-bar ──────────────────────────────────── -->
      <div class="border-b border-green-500/15 bg-black/50 backdrop-blur-sm px-4 sm:px-8
                  flex items-center justify-between">
        <div class="flex items-center gap-6">
          <span class="text-[9px] tracking-[0.3em] text-green-500/30 py-2">// ADMIN</span>
          <nav class="flex items-center gap-4">
            <a routerLink="/admin/scenarios" routerLinkActive="text-green-400"
              class="text-[10px] tracking-[0.2em] uppercase text-green-500/50
                     hover:text-green-300 transition-colors py-2 border-b border-transparent"
              [routerLinkActiveOptions]="{ exact: false }">
              Escenarios
            </a>
            <a routerLink="/admin/hex-types" routerLinkActive="text-green-400"
              class="text-[10px] tracking-[0.2em] uppercase text-green-500/50
                     hover:text-green-300 transition-colors py-2 border-b border-transparent"
              [routerLinkActiveOptions]="{ exact: false }">
              Hexes
            </a>
            <a routerLink="/admin/functions" routerLinkActive="text-green-400"
              class="text-[10px] tracking-[0.2em] uppercase text-green-500/50
                     hover:text-green-300 transition-colors py-2 border-b border-transparent"
              [routerLinkActiveOptions]="{ exact: false }">
              Funciones
            </a>
            <a routerLink="/admin/threats" routerLinkActive="text-green-400"
              class="text-[10px] tracking-[0.2em] uppercase text-green-500/50
                     hover:text-green-300 transition-colors py-2 border-b border-transparent"
              [routerLinkActiveOptions]="{ exact: false }">
              Amenazas
            </a>
          </nav>
        </div>
        <button (click)="logout()" type="button"
          class="text-[9px] tracking-[0.15em] uppercase text-green-500/30
                 hover:text-green-400 transition-colors py-2 cursor-pointer">
          Logout
        </button>
      </div>

      <!-- Content -->
      <router-outlet />
    }
  `,
})
export class AdminLayout {
  readonly auth = inject(AdminAuth);
  password = signal('');
  loginError = signal(false);
  loginLoading = signal(false);

  async onLogin(): Promise<void> {
    this.loginLoading.set(true);
    this.loginError.set(false);
    const ok = await this.auth.login(this.password());
    this.loginLoading.set(false);
    if (!ok) this.loginError.set(true);
  }

  logout(): void {
    this.auth.logout();
    this.password.set('');
  }
}
