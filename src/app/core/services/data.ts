import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, map } from 'rxjs';

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

  getGameConfig(): Observable<GameConfig> {
    return this.get<GameConfig>('assets/data/game-config.json');
  }

  getAttackFunctions(): Observable<AttackFunction[]> {
    return this.get<AttackFunctionRaw[]>('assets/data/tables/attack-functions.json').pipe(
      map(rows => rows.map(parseAttackFunction))
    );
  }

  getPoints(): Observable<PointDefinition[]> {
    return this.get<PointRaw[]>('assets/data/tables/points.json').pipe(
      map(rows => rows.map(parsePointDefinition))
    );
  }

  getInitialBotVariables(): Observable<BotVariableDefinition[]> {
    return this.get<BotVariableRaw[]>('assets/data/tables/initial-bot-variables.json').pipe(
      map(rows => rows.map(parseBotVariable))
    );
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

/* ── Game Config ──────────────────────────────────────────── */
export interface GameConfig {
  maxNibbles: number;
  maxBots: number;
  slotsPerVersion: { v1: number; v2: number; v3: number };
  improvementPoints: number;
  disadvantagePoints: number;
}

/* ── Attack Functions ─────────────────────────────────────── */
export interface AttackFunction {
  name: string;
  version: number;
  range: string;
  damage: string;
  energy: string;
  cost: number;
  effects: string;
}

interface AttackFunctionRaw {
  'Función': string;
  'V.~': string;
  'Rango~': string;
  'Daño~': string;
  'Energía~': string;
  'Coste~': string;
  'Efectos': string;
}

function stripBackticks(s: string): string {
  return s.replace(/`/g, '');
}

function parseAttackFunction(raw: AttackFunctionRaw): AttackFunction {
  return {
    name: stripBackticks(raw['Función']),
    version: parseInt(raw['V.~']),
    range: raw['Rango~'],
    damage: raw['Daño~'],
    energy: raw['Energía~'],
    cost: parseInt(raw['Coste~']),
    effects: raw['Efectos'],
  };
}

/* ── Point Definitions ────────────────────────────────────── */
export interface PointDefinition {
  constant: string;
  mejora: string;
  desventaja: string;
}

interface PointRaw {
  'Constante': string;
  'Punto de Mejora~': string;
  'Punto de Desventaja~': string;
}

function parsePointDefinition(raw: PointRaw): PointDefinition {
  return {
    constant: stripBackticks(raw['Constante']),
    mejora: raw['Punto de Mejora~'],
    desventaja: raw['Punto de Desventaja~'],
  };
}

/* ── Bot Variable Definitions ─────────────────────────────── */
export interface BotVariableDefinition {
  variable: string;
  initialValue: string;
  description: string;
}

interface BotVariableRaw {
  'Variable': string;
  'Valor Inicial~': string;
  'Propósito y Uso': string;
}

function parseBotVariable(raw: BotVariableRaw): BotVariableDefinition {
  return {
    variable: stripBackticks(raw['Variable']),
    initialValue: stripBackticks(raw['Valor Inicial~']),
    description: raw['Propósito y Uso'],
  };
}
