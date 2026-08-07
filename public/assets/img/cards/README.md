# Arte de las cartas

Un PNG por Función, con el **id** como nombre de archivo. La carta lo carga
desde `/assets/img/cards/<id>.png`; si el archivo no existe, el hueco muestra
el marcador «ARTE» y la carta sigue imprimiéndose bien.

El id se deduce del nombre de la Función (camelCase → kebab-case), así que
**una Función nueva no necesita tocar código**: basta con dejar aquí su PNG.
Si hiciera falta un nombre distinto, se fija con `"art"` en
`assets/data/cards.json`.

## Formato

El hueco del arte mide **35,6 × 13,8 mm** (apaisado, ratio ≈ 2,6:1) y se
recorta con `object-fit: cover`. A 600 ppp eso son **840 × 326 px**; sirve
cualquier tamaño mayor con esa proporción. Fondo oscuro: la carta es
`#0b0f0a` y el arte va pegado al marco, sin margen propio.

## Ids

| Versión | Función | Archivo |
|---|---|---|
| V1 | `powerSmash()` | `power-smash.png` |
| V1 | `rocketPunch()` | `rocket-punch.png` |
| V1 | `laserBeam()` | `laser-beam.png` |
| V1 | `dashStrike()` | `dash-strike.png` |
| V1 | `pinpointBurst()` | `pinpoint-burst.png` |
| V1 | `pulseShot()` | `pulse-shot.png` |
| V1 | `stabilizerHit()` | `stabilizer-hit.png` |
| V2 | `nanoRepair()` | `nano-repair.png` |
| V2 | `traceShot()` | `trace-shot.png` |
| V2 | `ghostProtocol()` | `ghost-protocol.png` |
| V2 | `peekMemory()` | `peek-memory.png` |
| V2 | `shadowStep()` | `shadow-step.png` |
| V2 | `overclockStrike()` | `overclock-strike.png` |
| V2 | `plasmaBolt()` | `plasma-bolt.png` |
| V2 | `chainLightning()` | `chain-lightning.png` |
| V2 | `berserkProtocol()` | `berserk-protocol.png` |
| V2 | `firewall()` | `firewall.png` |
| V2 | `gravityWell()` | `gravity-well.png` |
| V2 | `swapProtocol()` | `swap-protocol.png` |
| V2 | `ionCannon()` | `ion-cannon.png` |
| V2 | `deployBarrier()` | `deploy-barrier.png` |
| V3 | `overdriveStrike()` | `overdrive-strike.png` |
| V3 | `railgun()` | `railgun.png` |
| V3 | `chargedStrike()` | `charged-strike.png` |
| V3 | `dataSpike()` | `data-spike.png` |
| V3 | `flashSpin()` | `flash-spin.png` |
| V3 | `syncBlast()` | `sync-blast.png` |
| V3 | `relayNode()` | `relay-node.png` |
| V3 | `novaBlast()` | `nova-blast.png` |
| V3 | `empField()` | `emp-field.png` |
| COMMON | `move(n)` | `move.png` |
| COMMON | `shield()` | `shield.png` |
