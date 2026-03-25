# ROGUE.EXE: Enemigos

## Los Juniors Renegados

Durante las Firmware Wars existe un mercado negro de Programadores que nunca superaron la certificación Senior. Son los **Juniors Renegados** — técnicos con talento pero sin escrúpulos que operan en los márgenes de las arenas vendiendo sus servicios al mejor postor.

Sus Bots son chatarra reconstruida: pequeños, rápidos y baratos. Individualmente no suponen una amenaza para un Senior, pero en grupos coordinados pueden ser peligrosos. Las corporaciones los toleran porque añaden caos al espectáculo.

La audiencia los llama **ROGUE.EXE**.

> "No fallaron el examen. Decidieron no presentarse. Hay una diferencia."
> — K0-D3, Broker de Datos del Sector 7.

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
- El orden entre jugadores A y B se determina mediante **PPT protocol** al inicio de cada ronda.
- Los Bots de los jugadores siguen ejecutando su CORE.CYCLE completo (BOOT, COMPILE, RUN, DEBUG, END) con normalidad.


### Orden de activación de los ROGUE.EXE

Cada escenario define un **orden fijo de activación** para los ROGUE.EXE. Cada unidad tiene un identificador (SEN1, SEN2, SEN3...) que determina cuándo actúa.

Cuando le toca actuar al enemigo, se activa el siguiente ROGUE.EXE de la lista en orden. Al llegar al último, se vuelve al primero. Si un ROGUE.EXE es destruido, se salta en la rotación y actúa el siguiente.

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

---