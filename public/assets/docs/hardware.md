# HARDWARE.CFG: Componentes Necesarios

## Materiales del Sistema

Para ejecutar una partida de **Firmware Wars** necesitas los siguientes componentes físicos:

| Componente | Cantidad | Notas |
|---|---|---|
| Miniaturas (Bots) | Variable | Según lista acordada. Mínimo 1 por Programador. |
| Fichas Hex (tablero) | 30–50 piezas | Con cara negra para obstáculos. |
| Dado de 4 caras (d4) | 2 | Para operaciones V1 y V2. |
| Dado de 6 caras (d6) | 4 | Para combate, estados y algunas funciones. |
| Dado de 8 caras (d8) | 1 | Para algunas funciones de ataque. |
| Dado de 10 caras (d10) | 4 | Para condiciones de `RUN()` y `getNumbers()`. |
| Dado de 12 caras (d12) | 1 | Para recuperación de energía en algunos modelos. |
| Marcadores de `bugs` | 10+ | Uno por bug activo por Bot. |
| Marcadores de escudo | 10+ | Para registrar `shield` activo. |
| Marcadores de estado | 10+ | LAG, DMZ, SAFE_MODE, REBOOTING… |
| Fichas de energía | Variable | Para llevar el registro de `energy`. |
| Fichas de vida | Variable | Para llevar el registro de `life`. |
| Terminal de programación | 1 por jugador | Hoja de turno donde anotar el BattleScript. |

---

## El Terminal de Programación

Cada Programador dispone de un **Terminal**: una hoja de turno donde registra en tiempo real el estado de sus Bots y escribe el **BattleScript** — el código que sus unidades ejecutarán en la fase `RUN()`.

El Terminal incluye:

- Variables de estado de cada Bot: `life`, `energy`, `shield`, `bugs`, `version`, `numbers`.
- Ranuras de Operación para la fase `COMPILE()`.
- Área de escritura del BattleScript.
- Registro de efectos activos y estados alterados.

> Mantén tu Terminal actualizado en todo momento. Un error de registro puede costar una partida.

---

## Escala y Medidas

Las distancias se miden en **Hexes**. Cada desplazamiento o alcance se cuenta como el número mínimo de casillas hexagonales contiguas entre dos puntos del tablero, sin atravesar obstáculos.

No se usan reglas ni cintas métricas: el sistema hexagonal garantiza la equidad táctica de las distancias.
