import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  private get<T>(path: string): Observable<T> {
    if (!this.cache.has(path)) {
      this.cache.set(
        path,
        this.http.get<T>(path).pipe(shareReplay(1))
      );
    }
    return this.cache.get(path) as Observable<T>;
  }

  getRules(): Observable<RulesData> {
    return this.get<RulesData>('assets/data/rules.json');
  }

  getUnits(): Observable<UnitsData> {
    return this.get<UnitsData>('assets/data/units.json');
  }

  getFactions(): Observable<FactionsData> {
    return this.get<FactionsData>('assets/data/factions.json');
  }
}

export interface RulesSection {
  id: string;
  title: string;
  content: string;
  markdownFile?: string;
}

export interface RulesData {
  version: string;
  sections: RulesSection[];
}

export interface Stat {
  move: number;
  ranged: number;
  melee: number;
  defense: number;
  wounds: number;
}

export interface Unit {
  id: string;
  name: string;
  faction: string;
  points: number;
  keywords: string[];
  stats: Stat;
  abilities: string[];
}

export interface UnitsData {
  units: Unit[];
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  playstyle: string;
}

export interface FactionsData {
  factions: Faction[];
}
