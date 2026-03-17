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

export type DotColor = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'white';

export const DOT_COLORS: { id: DotColor; hex: string }[] = [
  { id: 'green', hex: '#22c55e' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'orange', hex: '#f97316' },
  { id: 'red', hex: '#ef4444' },
  { id: 'white', hex: '#ffffff' },
];

export interface DeploymentMarker {
  q: number;
  r: number;
  team: number;
  label?: string;
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
