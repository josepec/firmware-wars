# Simulador de Partidas — Roadmap

Feature admin-only bajo `/admin/simulator`. Registra Battle Reports como snapshot inicial + log de eventos append-only; el viewer replaya eventos para reconstruir estado paso a paso.

## Arquitectura

- **Backend**: endpoints REST en `firmware-wars-api/src/index.ts` (tabla `battle_reports` en D1). Append-only de eventos; el motor de reglas NO vive aquí.
- **Frontend motor de reglas**: `features/admin/simulator/engine/` (TS puro, sin Angular).
  - `dice.ts` → d6, dado de Operaciones V1/V2/V3, evaluador de comparadores.
  - `pathfinding.ts` → BFS sobre hex axial, distancia, LOS (supercover), hexes atacables.
  - `engine.ts` → `BattleEngine` con transiciones de fase; emite `BattleEvent`s.
  - `replay.ts` → `replayTo(snapshot, events, index)` reconstruye `BattleState`.
- **UI**: `simulator-list`, `simulator-setup` (wizard), `simulator-play` (hotseat), `simulator-viewer` (replay).

## Estado actual (v1 MVP táctico — parcial)

### Implementado

- CRUD Battle Reports (crear, listar, ver, borrar, append eventos, cerrar partida).
- Setup: elegir escenario o mapa rectangular custom; listas por ID.
- Viewer con timeline (play/pause/step/jump) aplicando `replayTo`.
- Hex-map extendido con `highlightedHexes`, `highlightColor`, `selectable`.
- Engine esqueleto: dados, pathfinding, resolución de move/attack/shield, overload, bugs, intercepción, fin de turno, chequeo de victoria.

### Pendiente dentro de v1

- Flujo completo de juego en `simulator-play.ts`: fases deploy → INIT (PPT) → BOOT (dados) → COMPILE (drag-drop de 3 Operaciones y bindeo de Funciones) → RUN (resolución línea a línea con elección de `numbers`) → DEBUG → END.
- Sub-componentes `phase-panel.ts`, `battle-log.ts`, `compile-editor.ts`.
- Resolución completa de IF / IF-ELSE / FOR / WHILE / TRY-CATCH con las reglas de Infinite Loop y condiciones de BUG por sintaxis.
- Upgrade automático rondas 3 y 5 a cargo del engine (hook ya presente en `setInit`).
- Validación del bucle único en COMPILE (no dos FOR/WHILE a la vez).
- Tabla de dado de Operaciones V1/V2/V3 calibrada con la hoja oficial del manual (caras actuales en `dice.ts` son un primer esqueleto — revisar contra manual antes de usar en producción).
- Feedback visual de highlight integrado en `simulator-play` (azul = movimiento válido, rojo = alcance de ataque, amarillo = candidato de intercepción).
- Funciones DEBUG básicas leyendo `debug-functions.json` (purga de BUGs, repair).

## Fuera de v1

- **Fase 2 — Reglas avanzadas**: rangos especiales (LR, SLDV, R(n) con splash), status effects temporales, amenazas activas del escenario, hexes especiales, objetivos distintos de aniquilación.
- **Fase 3 — Stats**: agregación sobre reports (win rate por bot/función, turno medio, daño medio).
- **Fase 4 — IA**: partidas automatizadas (Monte Carlo) para calibración.
- **Fase 5 — Multiplayer remoto**: hoy hotseat local; sockets + persistencia de partida en curso.
- **Editor completo de mapas in-situ**: v1 solo rectangular parametrizable; un editor visual completo reutilizaría el de escenarios.

## Notas de reglas (referencia rápida)

- Fuente canónica: `reglamento/core-cycle.md`, `reglamento/setup.md`, `reglamento/bots.md` en el repo de docs.
- PPT al principio de cada ronda decide orden de activación.
- BOOT: eliges n ∈ {1,2,3} y tiras n d6 para energía. Rellenas `numbers` hasta MAX. Tiras Operaciones (MAX_OPERATIONS − BUGs). Un único bucle (FOR o WHILE) permitido.
- COMPILE: ordenas las 3 Operaciones y bindeas move / attack / shield (o Funciones de ataque). No repetir función en ranuras de la misma Operación.
- RUN: tirada dado Operaciones (comparador + umbral) + d6 + elige un `number`. Compara para decidir TRUE/FALSE (IF, IF-ELSE) o cuántas iteraciones (FOR, WHILE). Intercepción: 1 por turno enemigo, el bot enemigo más cercano.
- Daño = max(0, daño función − escudo).
- OVERLOAD: si energía < coste, resta la diferencia a `life`.
- BUG: sintaxis inválida / Infinite Loop / WHILE sin ejecución / TRY-CATCH sin ejecución.
- DEBUG: opcional; aplica Funciones de Mantenimiento pagando energía.
- END: descarta Operaciones; conserva `numbers` y `energy`.
- Upgrade automático: V2 al inicio de la ronda 3, V3 al inicio de la ronda 5.
- Victoria: último jugador con bots vivos (aniquilación).
