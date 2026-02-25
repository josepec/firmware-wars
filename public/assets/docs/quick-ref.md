# Guía de Referencia Rápida

---

## INIT() — Inicio de Ronda

- **Negociación de CPU:** Todos los jugadores lanzan PPT (Piedra-Papel-Tijera).
- **Ganador:** Obtiene Prioridad de CPU.
- El turno rota entre jugadores (un Bot cada uno) hasta completar todos los Bots.
- Ronda 3 → `upgrade()` → Bots `version 2`.
- Ronda 5 → `upgrade()` → Bots `version 3`.

---

## BOOT() — Ambos jugadores

1. **Estado:** Si `life` ≤ 0 → Destruido. Limpiar efectos temporales.
2. **Energía:** Lanza `ENERGY_DICE` + `version`. Añade a `energy` sin superar `MAX_ENERGY`.
3. **Números:** Si `numbers` está vacío, ejecuta `getNumbers()`.
4. **Operaciones:** Tira 1 dado por ranura disponible (`MAX_OPERATIONS - bugs`).

| Resultado | V1 | V2 | V3 |
|---|---|---|---|
| 1 | IF | IF | IF |
| 2 | IF-ELSE | IF-ELSE | IF-ELSE |
| 3 | IF | FOR | FOR |
| 4 | IF-ELSE | WHILE | WHILE |
| 5 | IF | FOR | TRY-CATCH |
| 6 | IF-ELSE | WHILE | TRY-CATCH |

> Solo un bucle (FOR o WHILE) por turno. Si ya ha salido uno, vuelve a tirar.

5. Se puede saltar a la fase `DEBUG()` en vez de continuar con `COMPILE()`.

---

## COMPILE() — Ciclo del Bot

- Asigna las Operaciones obtenidas en el Terminal. No es necesario asignarlas todas.
- Asigna una Función `COMMON.INTERFACE` a cada Operación.

### COMMON.INTERFACE

| Función | Energía | Efecto |
|---|---|---|
| `move(n)` | n | Mueve n Hex. n ≤ `MAX_MOVEMENT`. |
| `attack(...)` | FnAtaque | Ejecuta una Función de Ataque. Daño = Daño Ataque − `shield`. |
| `shield()` | 2 | Añade +1 a `shield`. `shield` ≤ `MAX_SHIELD`. |

---

## RUN() — Ejecución

- Ejecuta línea por línea (Top-Down).
- **Condicionales:** `1d10 [comparador] numero`.
- **Interceptar:** El Bot enemigo más cercano puede interceptar una vez por turno → Setea 1 `numbers` en lugar del 1d10. Coste: 1 `energy`.
- **Costes:** Paga la `energy` requerida.
- **Overload:** Si no puedes pagar Energía, pagas con Vida (1 vida × energía faltante). La función **no se ejecuta**.
- **Sintaxis:** Error de regla o ejecución = 1 `bug`.

---

## DEBUG() — Mantenimiento

### DEBUG.INTERFACE

| Función | Energía | Efecto |
|---|---|---|
| `debug()` | 3 | Elimina 1 BUG. |
| `patch()` | 8 | Elimina TODOS los BUGS. |
| `optimize()` | 5 | +1 tiradas de Energía próximo turno. |
| `reboot()` | 0 | Reset total. Pierde siguiente turno. `energy=0`, `numbers=[]`, `bugs=0`. |

---

## END() — Fin del Ciclo

- Descartar Operaciones ejecutadas.
- Conservar los Números (`numbers`).
- Conservar la energía (`energy`).
- Si se han activado todos los Bots de ambos jugadores → **Termina Ronda**. Si no, pasa el turno al siguiente Programador.
