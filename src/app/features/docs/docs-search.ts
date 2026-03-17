/**
 * Client-side full-text search for reglamento docs.
 * Indexes markdown files + their referenced JSON tables.
 */

export interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  /** The paragraph or table row that matched */
  snippet: string;
  /** A unique text fragment to locate in the rendered DOM */
  matchText: string;
}

interface IndexEntry {
  sectionId: string;
  sectionTitle: string;
  text: string;
}

export class DocsSearchIndex {
  private entries: IndexEntry[] = [];
  private built = false;

  async build(configUrl: string, docsPath: string): Promise<void> {
    if (this.built) return;

    try {
      const resp = await fetch(configUrl);
      if (!resp.ok) return;
      const cfg = await resp.json();
      const sections: { id: string; subtitle: string }[] = cfg.sections ?? [];

      await Promise.all(sections.map(s => this.indexSection(s.id, s.subtitle, docsPath)));
      this.built = true;
    } catch (e) {
      console.error('[docs-search] Failed to build index:', e);
    }
  }

  search(query: string, maxResults = 20): SearchResult[] {
    const q = this.normalize((query ?? '').toLowerCase());
    if (q.length < 2) return [];
    const results: SearchResult[] = [];

    for (const entry of this.entries) {
      if (results.length >= maxResults) break;
      if (this.normalize(entry.text.toLowerCase()).includes(q)) {
        results.push({
          sectionId: entry.sectionId,
          sectionTitle: entry.sectionTitle,
          snippet: this.extractSnippet(entry.text, q),
          matchText: this.extractMatchLine(entry.text, q),
        });
      }
    }
    return results;
  }

  /** Normalizes special characters so keyboard-typeable queries match unicode text */
  private normalize(s: string): string {
    return s
      .replace(/≥/g, '>=')
      .replace(/≤/g, '<=')
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
      .replace(/—/g, '--')
      .replace(/–/g, '-')
      .replace(/◈/g, '')
      .replace(/\u00a0/g, ' ');
  }

  private async indexSection(id: string, title: string, docsPath: string): Promise<void> {
    try {
      const resp = await fetch(`/${docsPath}/${id}.md`);
      if (!resp.ok) return;
      const md = await resp.text();

      // Extract JSON table paths
      const jsonPaths = [...md.matchAll(/^\/json(?:-sm)?\s+(\S+)/gm)].map(m => m[1]);

      // Strip markdown to readable text
      const readable = this.stripMarkdown(md);
      const paragraphs = readable.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 5);

      for (const para of paragraphs) {
        this.entries.push({ sectionId: id, sectionTitle: title, text: para });
      }

      // Index JSON tables — matchText uses the first cell value (stripped) for DOM lookup
      for (const jsonPath of jsonPaths) {
        try {
          const jResp = await fetch(`/assets/data/${jsonPath}`);
          if (!jResp.ok) continue;
          const rows: Record<string, string>[] = await jResp.json();
          for (const row of rows) {
            const values = Object.values(row);
            const text = values.map(v => this.stripBackticks(v)).join(' — ');
            if (text.length > 3) {
              this.entries.push({ sectionId: id, sectionTitle: title, text });
            }
          }
        } catch { /* skip broken table */ }
      }
    } catch { /* skip broken section */ }
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/\r\n/g, '\n')
      .replace(/^\/(json|json-sm|img-center|img-small|img|page|col|end-col|keep|end-keep|space|blank-page|two-col|three-col|two-columns|three-columns|end-columns)\b.*$/gm, '')
      .replace(/\{\{([^}]+)\}\}/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^---+$/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private stripBackticks(text: string): string {
    return text.replace(/`([^`]+)`/g, '$1');
  }

  /** Finds a DOM-matchable fragment from the line containing the query */
  private extractMatchLine(text: string, query: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (this.normalize(line.toLowerCase()).includes(query)) {
        // Strip markdown artifacts that won't appear in rendered DOM
        const clean = line
          .replace(/^\d+\.\s+/, '')      // ordered list markers
          .replace(/^\||\|$/g, '')        // table pipe boundaries
          .replace(/\|/g, ' ')            // inner pipes
          .replace(/[ \t]+/g, ' ')
          .trim();
        // Return a fragment around the match for precise DOM matching
        const idx = this.normalize(clean.toLowerCase()).indexOf(query);
        if (idx !== -1) {
          const start = Math.max(0, idx - 20);
          const end = Math.min(clean.length, idx + query.length + 40);
          return clean.slice(start, end).trim();
        }
        return clean.slice(0, 80);
      }
    }
    return text.slice(0, 80).trim();
  }

  private extractSnippet(text: string, query: string): string {
    const maxLen = 120;
    const lower = this.normalize(text.toLowerCase());
    const idx = lower.indexOf(query);
    if (idx === -1) return text.slice(0, maxLen);

    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 80);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  }
}
