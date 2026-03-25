# 01 — Estructura de la Campaña

## ¿Qué es el modo campaña?

El modo campaña de Firmware Wars es una experiencia para **2 jugadores** estructurada en **3 Actos** y **10 Escenarios**, donde cada Programador representa a una de las **Cinco Grandes Corporaciones** compitiendo en las 28ª Firmware Wars.

A diferencia del modo escaramuza, la campaña introduce progresión permanente entre partidas: los Bots ganan experiencia, el arsenal se amplía comprando funciones en el MARKET.SYS, y las decisiones tomadas a lo largo de la campaña determinan cuál de los **5 Finales** posibles se desencadena.

---

## Preparación de la campaña

Antes de empezar, cada jugador:

1. **Elige su Corporación** entre las Cinco Grandes (ver `07_CORPORATIONS.md`).
2. **Crea su Programador Senior** — Alias, trasfondo corporativo y Directiva Primaria.
3. **Construye sus Bots** con el presupuesto inicial de **120◈ por Bot** (igual que en el modo base).
4. **Determina el número de Bots** — Se recomienda **2 Bots por jugador** para la campaña.
5. **Registra la campaña en la web** para activar el sistema de IDC y Decisiones Corporativas.

> *Recuerda: Puedes construir tus Bots fácilmente desde el apartado Lista de la web.*

---

## Estructura de Actos

### ACTO I — Grid-Zone Qualifiers
**3 Escenarios versus**

Los dos Programadores son rivales dentro del circuito de clasificación corporativa. Compiten por el puesto de representante oficial en las Firmware Wars. Los escenarios son combates directos en arenas de clasificación.

**Reglas especiales del Acto I:**
- La corporación cubre **todas las reparaciones** de Bots destruidos. No hay coste de reparación.
- Al final del Acto I se determina quién es el **Programador Principal** (más victorias) y quién el **Programador Secundario**. El Principal tiene prioridad en el MARKET.SYS. El Secundario recibe **+20◈ de compensación**.

---

### ACTO II — Phase Groups (Cooperativo)
**3 Escenarios cooperativos**

Los dos Programadores son ahora aliados temporales enfrentándose a los **ROGUE.EXE** — Juniors Renegados que operan en los márgenes de las arenas (ver `06_ROGUE_EXE.md`). Cada escenario tiene su propio objetivo de victoria.

**Reglas especiales del Acto II:**
- La corporación cubre la **primera reparación** por escenario. Las bajas adicionales cuestan **25◈**.
- El IDC se mueve por rendimiento individual dentro del cooperativo (ver `02_IDC.md`).
- Cada escenario tiene un **objetivo de victoria propio** — no es eliminación total.

---

### ACTO III — Semifinals & Final
**3 Escenarios versus + 1 Escenario Final**

Vuelve el versus. Los escenarios son más complejos, con tableros que incluyen zonas especiales y efectos por ronda. El Escenario Final depende del IDC acumulado y puede ser de distintos tipos según el final al que se aproximen los jugadores.

**Reglas especiales del Acto III:**
- La corporación cubre la **primera reparación** por escenario. Las bajas adicionales cuestan **25◈**.
- Al llegar al Escenario Final, la web revela el final hacia el que se dirigen los jugadores y presenta el escenario correspondiente.

---

## Mapa de escenarios

| # | Acto | Tipo | Notas |
|---|---|---|---|
| 1 | I | Versus | — |
| 2 | I | Versus | Decisión Corporativa tras este escenario |
| 3 | I | Versus | Decisión Corporativa tras este escenario |
| 4 | II | Cooperativo — PURGE.PROTOCOL | — |
| 5 | II | Cooperativo — SIEGE.MODE | Decisión Corporativa tras este escenario |
| 6 | II | Cooperativo — CORE.HUNT | Decisión Corporativa tras este escenario |
| 7 | III | Versus | — |
| 8 | III | Versus | Decisión Corporativa tras este escenario |
| 9 | III | Versus | Decisión Corporativa antes del Final |
| 10 | Final | Variable según IDC | Ver `08_ENDINGS.md` |

> Las Decisiones Corporativas se presentan automáticamente a través de la web en el momento indicado.

---

## Regla de empate

Cuando ambos jugadores cumplen o pierden la condición de victoria en el mismo turno, el escenario termina en **empate**. La resolución por defecto es:

> *Ambos jugadores reciben la recompensa de **victoria con bajas (25◈)**, independientemente del estado de sus Bots al finalizar.*

Esta regla aplica a todos los escenarios salvo que la ficha del escenario indique explícitamente una resolución de empate diferente.

---

## Upgrades de Bots en campaña

Los Bots siguen el sistema de upgrade del juego base:
- **Ronda 3** → `upgrade()` → Versión 2
- **Ronda 5** → `upgrade()` → Versión 3

Esto ocurre dentro de cada escenario de forma independiente. Los Bots no mantienen su versión entre escenarios — cada partida empieza desde Versión 1.

Lo que sí persiste entre escenarios son los **Puntos de Mejora de campaña** ganados mediante XP (ver `03_XP.md`), que modifican las Constantes del Bot de forma permanente.
