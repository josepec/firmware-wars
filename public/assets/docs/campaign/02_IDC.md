# 02 — Índice de Dominancia Corporativa

## ¿Qué es el IDC?

El **Índice de Dominancia Corporativa (IDC)** es un valor interno que mide la posición de poder de cada Programador a lo largo de la campaña. Determina, junto con los resultados de combate y las Decisiones Corporativas, cuál de los **5 Finales** posibles se desencadena.

- **Rango:** 0 a 10
- **Valor inicial:** 5 (equilibrio)
- **Visibilidad:** El jugador ve su estado narrativo aproximado, no el valor exacto
- **Gestión:** Exclusivamente a través de la web

> El IDC no se revela hasta el final del Acto III. La web muestra únicamente una descripción narrativa aproximada.

---

## Estado narrativo visible

| Rango IDC | Lo que ve el jugador en la web |
|---|---|
| 0–2 | *Sistema crítico. Señal corporativa débil.* |
| 3–4 | *Rendimiento por debajo de lo esperado.* |
| 5 | *Equilibrio operativo. Sin ventaja detectada.* |
| 6–7 | *Dominancia creciente en el mercado.* |
| 8–10 | *Control total de la red. Corporación hegemónica.* |

---

## Modificadores por combate

### Escenarios versus (Acto I y III)

| Evento | Modificador IDC |
|---|---|
| Victoria en escenario versus | +1 |
| Victoria con todos los Bots vivos | +1 adicional |
| Eliminar el último Bot enemigo en ronda 1–2 | +1 (solo si no hay otro +1 ya acumulado ese escenario) |
| Derrota sin perder ningún Bot | −1 |
| Perder todos los Bots | −2 |

> **Límite por escenario versus:** máximo +2 / mínimo −2 por escenario.

### Escenarios cooperativos (Acto II)

| Evento | Modificador IDC |
|---|---|
| Ser el jugador que elimina más Bots enemigos en el escenario | +1 |
| Completar el escenario sin ninguna baja propia | +1 |
| Empate en eliminaciones | 0 |
| Perder todos tus Bots en el escenario | −1 |

> Máximo +1 por escenario cooperativo.

---

## Decisiones Corporativas

A lo largo de la campaña, la web presenta **6 Decisiones Corporativas** en momentos clave. Cada decisión tiene dos opciones con consecuencias distintas en IDC y a veces en Nibbles o mecánicas menores.

El contenido exacto de cada decisión se gestiona exclusivamente por la web para preservar la sorpresa. Las decisiones aparecen en los momentos indicados en el mapa de escenarios (`01_STRUCTURE.md`).

**Impacto por decisión:** entre −2 y +2 puntos de IDC.
**Total acumulable por decisiones:** entre −4 y +5 puntos en toda la campaña.

### Decisión especial — Alianza Secreta (Acto III, antes del Final)

La última Decisión Corporativa presenta a ambos jugadores la posibilidad de una **alianza secreta**. La web gestiona esta decisión de forma simultánea — ningún jugador ve la respuesta del otro hasta que ambos han decidido.

| Resultado | Efecto |
|---|---|
| Ambos aceptan | IDC de ambos se resetea a 5 → Activa Final BACKDOOR ALLIANCE |
| Solo uno acepta | El que aceptó pierde 1 IDC por ingenuidad |
| Ambos rechazan | Sin cambio — continúa hacia el final orgánico |

> La Alianza Secreta solo puede activar BACKDOOR ALLIANCE si ambos jugadores tienen IDC entre 3 y 7 al llegar al Acto III. Si uno domina claramente, la alianza no tiene efecto narrativo ni mecánico.

---

## Movimiento total del IDC en una campaña completa

| Fuente | Movimiento máximo teórico | Movimiento realista |
|---|---|---|
| Combate versus (7 escenarios) | ±14 | ±5 a ±7 |
| Cooperativo Acto II (3 escenarios) | ±3 | ±1 a ±2 |
| Decisiones Corporativas (6 decisiones) | ±12 | ±4 a ±6 |
| **IDC final desde base 5** | Techo 10 / Suelo 0 | **Rango realista: 3–9** |

---

## Los 5 Finales

| IDC Jugador A | IDC Jugador B | Final |
|---|---|---|
| 8–10 | 0–4 | **SYSTEM OVERRIDE** |
| 7–10 | 5–7 | **HOSTILE TAKEOVER** |
| 4–6 | 4–6 | **MERGE PROTOCOL** |
| 0–4 | 0–4 | **KERNEL PANIC** |
| Alianza activada (IDC ambos 3–7) | — | **BACKDOOR ALLIANCE** |

> El contenido narrativo y los escenarios finales de cada desenlace están detallados en `08_ENDINGS.md`.

> BACKDOOR ALLIANCE tiene prioridad sobre cualquier otro final si se activa correctamente.
