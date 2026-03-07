/**
 * Replaces <span class="md-cfg" data-key="..."> placeholders
 * with values from game-config.json.
 *
 * Supports dot notation for nested keys: {{slotsPerVersion.v1}} → 2
 */

let configCache: Record<string, string> | null = null;

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v as Record<string, unknown>, key));
    } else {
      result[key] = String(v);
    }
  }
  return result;
}

async function loadConfig(): Promise<Record<string, string>> {
  if (configCache) return configCache;
  const resp = await fetch('/assets/data/game-config.json');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  configCache = flatten(await resp.json());
  return configCache;
}

export async function hydrateConfigVars(container: HTMLElement): Promise<void> {
  const spans = container.querySelectorAll<HTMLElement>('.md-cfg');
  if (!spans.length) return;

  const cfg = await loadConfig();

  for (const span of Array.from(spans)) {
    const key = span.dataset['key'];
    if (!key) continue;
    span.textContent = cfg[key] ?? `{{${key}}}`;
  }
}
