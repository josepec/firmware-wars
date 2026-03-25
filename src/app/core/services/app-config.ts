import { Injectable } from '@angular/core';

interface AppConfigData {
  categories?: Record<string, { visible?: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class AppConfig {
  private configPromise: Promise<AppConfigData> | null = null;
  private config: AppConfigData = {};

  private load(): Promise<AppConfigData> {
    if (!this.configPromise) {
      this.configPromise = fetch('/assets/config/app.config.json')
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({}))
        .then((cfg: AppConfigData) => { this.config = cfg; return cfg; });
    }
    return this.configPromise;
  }

  async isCategoryVisible(id: string): Promise<boolean> {
    const cfg = await this.load();
    const entry = cfg.categories?.[id];
    return entry ? entry.visible !== false : true;
  }

  isCategoryVisibleSync(id: string): boolean {
    const entry = this.config.categories?.[id];
    return entry ? entry.visible !== false : true;
  }
}
