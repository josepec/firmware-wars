import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAuth } from '../../core/services/admin-auth';

const API_URL = 'https://firmware-wars-api.josepec.eu';

interface ScenarioSummary {
  id: string;
  title: string;
  updated_at: string;
}

@Component({
  selector: 'app-admin',
  imports: [RouterLink, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly auth = inject(AdminAuth);

  scenarios = signal<ScenarioSummary[]>([]);
  loading = signal(false);
  deleteConfirm = signal<string | null>(null);

  ngOnInit() {
    this.loadScenarios();
  }

  async loadScenarios(): Promise<void> {
    this.loading.set(true);
    try {
      const resp = await fetch(`${API_URL}/api/scenarios`);
      if (resp.ok) {
        this.scenarios.set(await resp.json());
      }
    } catch { /* ignore */ }
    this.loading.set(false);
  }

  confirmDelete(id: string): void {
    this.deleteConfirm.set(id);
  }

  cancelDelete(): void {
    this.deleteConfirm.set(null);
  }

  async deleteScenario(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/scenarios/${id}`, {
        method: 'DELETE',
        headers: this.auth.authHeaders(),
      });
      this.scenarios.update(list => list.filter(s => s.id !== id));
    } catch { /* ignore */ }
    this.deleteConfirm.set(null);
  }
}
