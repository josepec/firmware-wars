# Attack Animations — Design

Animaciones SVG para el simulador. Cada ataque del motor emite un `BattleEvent` de tipo `attack_hit`; el viewer y el play-panel escuchan ese evento y lanzan la animación correspondiente.

Librería elegida: **anime.js** (SVG-native, ~17 KB, sin dependencias).
Texto flotante (daño, estados): **CSS keyframes puros**, sin librería.

---

## Arquitectura

```
animations/
  README.md              ← este fichero
  attack-animator.ts     ← servicio Angular que recibe un AttackAnimEvent y despacha al primitivo correcto
  primitives/
    line.ts              ← A — haz/línea de A a B
    projectile.ts        ← B — círculo que viaja de A a B
    impact.ts            ← C — flash + anillo expansivo en un hex
    self-aura.ts         ← D — efecto centrado en el propio bot
    aoe-ring.ts          ← E — anillo que se expande desde un centro
    chain-arcs.ts        ← F — rayos en cadena entre N hexes
    push-arrow.ts        ← G — flecha direccional de empuje
    swap-arcs.ts         ← H — dos arcos curvados cruzados simultáneos
    materialize.ts       ← I — hex que "construye" con líneas
    status-glitch.ts     ← J — overlay de estado (LAG / BUG / DMZ / ERASE)
    floating-text.ts     ← K — texto que sube y se desvanece (daño, buff, estado)
```

Cada primitivo expone una función asíncrona:
```ts
function primitive(svg: SVGSVGElement, params: XxxParams): Promise<void>
```

`attack-animator.ts` recibe un `AttackAnimEvent` (id de función + coordenadas pixel de origen, destino y secundarios) y llama al primitivo adecuado con los parámetros de color/tamaño definidos en la tabla de abajo.

---

## Primitivos

### A — `line(from, to, color, width, durationMs)`
Línea SVG `<line>` que crece de `from` a `to` con `stroke-dashoffset` y luego se desvanece.
Uso: haces continuos (laser, ion, railgun).

### B — `projectile(from, to, color, radius, durationMs)`
Círculo `<circle>` que recorre el trayecto A→B via `translate`, con estela de opacidad.
Uso: proyectiles con trayectoria visible.

### C — `impact(hex, color, scale)`
Flash instantáneo: círculo opaco que se expande y desvanece (scale 0→1.4, opacity 1→0).
Uso: golpes cuerpo a cuerpo e impactos.

### D — `selfAura(hex, color, kind)`
`kind`: `'heal' | 'shield' | 'buff' | 'rage' | 'charge' | 'fade'`
- `heal` → partículas `<circle>` pequeñas que ascienden y se desvanecen.
- `shield` → hexágono de contorno que pulsa.
- `buff` → anillo que irradia hacia fuera.
- `rage` → destello rojo + aura pulsante.
- `charge` → glow que crece progresivamente (para ataques con acumulación).
- `fade` → hex origen se oscurece (para teleport).

### E — `aoeRing(center, radius, color, implosion?)`
Anillo `<circle>` que se expande hasta cubrir el radio indicado y se desvanece.
`implosion: true` invierte la dirección (para gravityWell).

### F — `chainArcs(hexes[], color)`
Para cada par consecutivo de hexes: `<path>` curvado animado con `stroke-dashoffset`.
Dibuja el arco de 0→1→0 con un pequeño retraso entre saltos.

### G — `pushArrow(hex, dir, color)`
`<line>` + cabeza de flecha `<polygon>` en la dirección `dir: [dq, dr]` del empuje.
Aparece en el hex objetivo y se desvanece tras 400 ms.

### H — `swapArcs(hex1, hex2)`
Dos arcos curvados en colores de cada equipo que viajan simultáneamente en sentidos opuestos.

### I — `materialize(hex, color)`
Seis líneas `<line>` que parten del centro y trazan los lados del hexágono, con retraso escalonado.
Al terminar, el elemento SVG de entidad ya está renderizado.

### J — `statusGlitch(hex, kind)`
`kind`: `'LAG' | 'BUG' | 'DMZ' | 'ERASE'`
- `LAG` → hex tiembla (translate oscillation pequeño).
- `BUG` → glitch de color (hue-rotate rápido + ruido visual con rect pixelados).
- `DMZ` → estática azul eléctrica (líneas horizontales parpadeantes).
- `ERASE` → caracteres de código que se borran de arriba abajo.

### K — `floatingText(hex, text, color)`
`<text>` SVG que aparece sobre el hex, sube ~20 px y se desvanece en 900 ms.
Se usa para: daño numérico (`-2`), estados (`LAG`, `SAFE`), buff (`BUFF+`), curación (`+3`).

---

## Mapa ataque → primitivos

### V1

| Ataque | Primitivos | Color principal | Notas |
|---|---|---|---|
| `laserBeam` | A line | `#22d3ee` cian | Delgada (width 1.5), rápida (180 ms) |
| `rocketPunch` | B projectile → C impact | `#f97316` naranja | Bola r=4, impacto en destino |
| `pinpointBurst` | A line | `#f8fafc` blanco | Más corta y delgada que laser |
| `pulseShot` | B projectile | `#a78bfa` violeta | Más lenta (350 ms), estela larga |
| `stabilizerHit` | B projectile → J statusGlitch(LAG) | `#94a3b8` gris | Proyectil + hex objetivo tiembla |
| `powerSmash` | C impact → G pushArrow | `#ef4444` rojo | Flash en objetivo + flecha de empuje |
| `dashStrike` | trail atacante + C impact | `#f97316` naranja | Trazo de movimiento + golpe al llegar |

### V2

| Ataque | Primitivos | Color principal | Notas |
|---|---|---|---|
| `nanoRepair` | D selfAura(heal) + K floatingText(+X) | `#22c55e` verde | Partículas verdes ascendentes |
| `traceShot` | A line (scan horizontal) | `#38bdf8` azul claro | Barre de lado a lado del hex objetivo |
| `plasmaBolt` | B projectile [+ B projectile inverso si backfire] | `#84cc16` lima | Si daño ≥ 6: segundo proyectil hacia el atacante |
| `firewall` | D selfAura(shield) + K floatingText(SAFE) | `#3b82f6` azul | Hexágono de contorno que pulsa |
| `ionCannon` | A line gruesa | `#e0f2fe` blanco-azul | width 4, casi instantánea (80 ms) |
| `shadowStep` | D selfAura(fade) + C impact en destino | `#7c3aed` púrpura | Hex origen se oscurece, destino flashea |
| `swapProtocol` | H swapArcs | equipo 1 / equipo 2 | Arcos con color de cada equipo |
| `overclockStrike` | D selfAura(buff) + K floatingText(BUFF+) | `#facc15` amarillo | Pulso que irradia hacia fuera |
| `berserkProtocol` | C impact(self) + D selfAura(rage) + K floatingText(-X) | `#dc2626` rojo | Autodaño + aura si sobrevive |
| `chainLightning` | F chainArcs | `#fbbf24` amarillo eléctrico | Arcos encadenados entre todos los objetivos |
| `gravityWell` | E aoeRing(implosion) + G pushArrow × N | `#581c87` violeta oscuro | Implosión + flechas de atracción hacia centro |
| `ghostProtocol` | J statusGlitch(ERASE) | `#64748b` gris | Código que se borra en el objetivo |
| `peekMemory` | — ninguna — | — | Sin efecto real en simulador AI |
| `deployBarrier` | I materialize | `#4b5563` gris oscuro | Líneas forman el hexágono de barrera |

### V3

| Ataque | Primitivos | Color principal | Notas |
|---|---|---|---|
| `overdriveStrike` | D selfAura(charge) → B projectile → C impact | `#f59e0b` ámbar | Carga en bot, luego dispara |
| `dataSpike` | B projectile + J statusGlitch(BUG) | `#10b981` verde matrix | Proyectil pixelado + glitch en objetivo |
| `syncBlast` | E aoeRing pequeño + C impact | `#06b6d4` cian | Onda concéntrica de sincronización |
| `novaBlast` | C impact (grande) + C impact(self recoil) | `#fbbf24` → `#ef4444` | Gran explosión + recoil rojo en atacante |
| `flashSpin` | Rotación 360° con estelas radiales × 6 dirs | `#e2e8f0` blanco | Giro con rayos a los 6 hexes adyacentes |
| `empField` | E aoeRing + J statusGlitch(DMZ) × N | `#0ea5e9` azul eléctrico | Pulso EMP que se expande + estática en afectados |
| `chargedStrike` | D selfAura(charge progresivo) + C impact fuerte | `#f59e0b`→`#dc2626` | Color de carga según daño acumulado |
| `railgun` | A line ultra-rápida + C impact × bots perforados | `#f8fafc` blanco | Bala que perfora hexes en línea recta |
| `relayNode` | I materialize + E aoeRing inicial | color de equipo | Como deployBarrier + ping inicial |

---

## AttackAnimEvent (interfaz de entrada)

```ts
export interface AttackAnimEvent {
  attackId: string;           // id del ataque (ej. 'chainLightning')
  attackerPx: { x: number; y: number };
  targetPx:   { x: number; y: number } | null;
  secondaryPx: { x: number; y: number }[];
  damage:     number;         // para floatingText
  statusApplied?: string;     // 'LAG' | 'SAFE_MODE' | 'DMZ' | etc.
  pushDir?:   [number, number]; // para pushArrow
  svgEl:      SVGSVGElement;
}
```

`simulator-play.ts` y `simulator-viewer.ts` construyen este objeto a partir de `BattleEvent` + `renderedHexes()` y llaman a `AttackAnimator.play(event)`.

---

## Duración orientativa por familia

| Primitivo | Duración total |
|---|---|
| A line | 150–300 ms |
| B projectile | 250–400 ms |
| C impact | 300 ms |
| D selfAura | 500–700 ms |
| E aoeRing | 400–600 ms |
| F chainArcs | 150 ms × salto |
| G pushArrow | 400 ms |
| H swapArcs | 500 ms |
| I materialize | 600 ms |
| J statusGlitch | 500 ms |
| K floatingText | 900 ms |

El simulador puede ejecutar la siguiente acción cuando la animación del ataque resuelve (awaitable Promise).
