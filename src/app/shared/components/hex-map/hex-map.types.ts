export interface HexTypeDefinition {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  properties: Record<string, string>;
  builtIn: boolean;
}

export interface HexCell {
  q: number;
  r: number;
  typeId: string;
  dot?: DotColor;
}

export type DotColor = 'green' | 'blue' | 'yellow' | 'orange' | 'red';

export const DOT_COLORS: { id: DotColor; hex: string }[] = [
  { id: 'green', hex: '#22c55e' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'orange', hex: '#f97316' },
  { id: 'red', hex: '#ef4444' },
];

export type MarkerType = 'player' | 'treasure' | 'flag' | 'plaque' | 'threat';

export const MARKER_TYPES: { id: MarkerType; label: string; prefix: string }[] = [
  { id: 'player', label: 'Programador', prefix: 'P' },
  { id: 'threat', label: 'Amenaza', prefix: 'A' },
  { id: 'treasure', label: 'Tesoro', prefix: 'T' },
  { id: 'flag', label: 'Bandera', prefix: 'B' },
  { id: 'plaque', label: 'Nodo de Datos', prefix: 'X' },
];

export interface DeploymentMarker {
  q: number;
  r: number;
  type: MarkerType;
  team?: number;
  label: string;
  threatId?: string;
  imageUrl?: string;
  active?: boolean;
  destroyed?: boolean;
  tooltip?: string;
}

export interface HexMapData {
  hexTypes: HexTypeDefinition[];
  hexes: HexCell[];
  deployments: DeploymentMarker[];
}

export const DEFAULT_HEX_TYPES: HexTypeDefinition[] = [
  { id: 'normal', name: 'Normal', color: '#ffffff', borderColor: '#1a1a1a', properties: {}, builtIn: true },
  { id: 'obstacle', name: 'Obstaculo', color: '#1a1a1a', borderColor: '#333333', properties: { traversable: 'false' }, builtIn: true },
];

export function emptyMapData(): HexMapData {
  return {
    hexTypes: [...DEFAULT_HEX_TYPES],
    hexes: [],
    deployments: [],
  };
}

/** Axial hex to pixel (flat-top) */
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (3 / 2) * q;
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

/** Generate flat-top hex polygon points */
export function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/** Get the 6 axial neighbor coordinates */
export function hexNeighbors(q: number, r: number): { q: number; r: number }[] {
  return [
    { q: q + 1, r }, { q: q - 1, r },
    { q, r: r + 1 }, { q, r: r - 1 },
    { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 },
  ];
}
