# 06 — ROGUE_EXE.MD — Acto II y Enemigos ROGUE.EXE

## Los Juniors Renegados

Durante las Firmware Wars existe un mercado negro de Programadores que nunca superaron la certificación Senior. Son los **Juniors Renegados** — técnicos con talento pero sin escrúpulos que operan en los márgenes de las arenas vendiendo sus servicios al mejor postor.

Sus Bots son chatarra reconstruida: pequeños, rápidos y baratos. Individualmente no suponen una amenaza para un Senior, pero en grupos coordinados pueden ser peligrosos. Las corporaciones los toleran porque añaden caos al espectáculo.

La audiencia los llama **ROGUE.EXE**.

> *"No fallaron el examen. Decidieron no presentarse. Hay una diferencia."* — K0-D3, Broker de Datos del Sector 7.

---

## Stats de los ROGUE.EXE

| Variable | Valor |
|---|---|
| MAX_LIFE | 8 |
| MAX_ENERGY | 8 |
| MAX_SHIELD | 0 |
| MAX_MOVEMENT | 3 |
| Versión | 1 |
| Funciones de ataque | Máximo 2, solo V1 |

Son más rápidos que los Bots de los jugadores (MAX_MOVEMENT 3 vs 2 base) pero mucho más frágiles. Mueren en pocos golpes pero pueden acorralar si no se gestionan bien.

Cada tipo de ROGUE.EXE tiene su propio **flowchart de IA** detallado en la ficha del escenario correspondiente.

---

## Gestión del turno en el cooperativo

El turno en los escenarios del Acto II sigue este patrón:

```
Bot Jugador A → ROGUE.EXE → Bot Jugador B → ROGUE.EXE → ...
```

Si hay más Bots por jugador, el patrón se extiende:

```
Bot A1 → ROGUE.EXE → Bot B1 → ROGUE.EXE → Bot A2 → ROGUE.EXE → Bot B2 → ROGUE.EXE
```

**Reglas:**
- Cada vez que le toca actuar a ROGUE.EXE, se activa **un solo Bot enemigo** siguiendo su flowchart.
- El orden entre jugadores A y B se determina mediante **PPT protocol** al inicio de cada ronda. El ganador elige si va primero o segundo.
- Los Bots de los jugadores siguen ejecutando su CORE.CYCLE completo (BOOT, COMPILE, RUN, DEBUG, END) con normalidad.

---

## Los 3 Escenarios del Acto II

### Escenario 4 — PURGE.PROTOCOL

**Objetivo:** Elimina todos los ROGUE.EXE antes de que completen 5 rondas.

Los ROGUE.EXE intentan llegar a un Hex objetivo en el centro del tablero. Si alguno lo alcanza, activa un protocolo de interferencia que da **1 BUG a todos los Bots de los jugadores**.

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 3 | No hay refuerzos |

**Condición de victoria:** Eliminar todos los ROGUE.EXE antes del inicio de la ronda 6.
**Condición de derrota:** Inicio de ronda 6 con algún ROGUE.EXE vivo.

---

### Escenario 5 — SIEGE.MODE

**Objetivo:** Defended una zona central durante 6 rondas.

Hay una zona de **3 Hexes contiguos** en el centro del tablero que los jugadores deben mantener libre de ROGUE.EXE. Los refuerzos aparecen en Hexes de borde predeterminados.

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 4 | 1 ROGUE.EXE cada 2 rondas |

**Condición de victoria:** Ningún ROGUE.EXE ocupa la zona al final de la ronda 6.
**Condición de derrota:** Un ROGUE.EXE ocupa la zona al final de cualquier ronda.

---

### Escenario 6 — CORE.HUNT

**Objetivo:** Elimina al ROGUE.EXE Líder antes de que escape.

Entre los ROGUE.EXE hay un **Líder** con stats mejorados que intenta escapar por un Hex de salida en el borde del tablero. Los demás ROGUE.EXE son distracción.

**Stats del Líder:**

| Variable | Valor |
|---|---|
| MAX_LIFE | 12 |
| MAX_ENERGY | 10 |
| MAX_MOVEMENT | 4 |

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 5 (incluido el Líder) | 2 ROGUE.EXE al inicio de ronda 3 |

**Condición de victoria:** El Líder es destruido antes de alcanzar el Hex de salida.
**Condición de derrota:** El Líder alcanza el Hex de salida.

---

## IDC en el Acto II

Aunque los jugadores son aliados, las corporaciones miden el rendimiento individual. Los modificadores de IDC del cooperativo son:

| Evento | Modificador IDC |
|---|---|
| Ser el jugador que elimina más ROGUE.EXE en el escenario | +1 |
| Completar el escenario sin ninguna baja propia | +1 |
| Empate en eliminaciones | 0 |
| Perder todos tus Bots en el escenario | −1 |

> Máximo +1 de IDC por escenario cooperativo.
