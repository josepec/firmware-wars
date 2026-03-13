# Guía de Referencia Rápida

/two-col

## INIT() — Inicio de Ronda

- **PPT Protocol.** Piedra-Papel-Tijera. Ganador → **Prioridad de CPU**.
- Turno rota entre Programadores (un Bot cada uno).
- **Ronda 3** → `upgrade()` → `version` 2.
- **Ronda 5** → `upgrade()` → `version` 3.

## BOOT() — Simultáneo

1. **Estado.** `life` ≤ 0 → Destruido. Limpiar efectos temporales.
2. **Energía.** `getEnergy(n)` — nd6 (n=1–3), suma a `energy`. Si > `MAX_ENERGY` → `BUG`.
3. **Números.** `getNumbers()` — Rellena `numbers` con d6 hasta `MAX_NUMBERS`.
4. **Operaciones.** Dado de Versión × ranura (`MAX_OPERATIONS` − `bugs`). Solo 1 bucle/turno.
5. Puede saltar directo a `DEBUG()`.

## COMPILE() — Programación

- Ordena Operaciones en el Terminal. No es necesario usar todas.
- Asigna Función a cada Operación.
- Duales (`IF-ELSE`, `TRY-CATCH`): Primaria obligatoria, secundaria opcional. No repetir Función.

### COMMON.INTERFACE

/json-sm tables/common-functions.json

## Operaciones

| Op. | Resolución |
|---|---|
| `IF` | TRUE → Ejecuta fn. FALSE → Nada. |
| `IF-ELSE` | TRUE → fn IF. FALSE → fn ELSE. |
| `FOR` | \|1d6 − numbers\| = reps. >3 o 0 → `BUG`. |
| `WHILE` | Repite mientras TRUE. 0 veces → `BUG`. |
| `TRY-CATCH` | TRY falla → CATCH. Ninguna → `BUG`. |

/col

## RUN() — Ejecución

Ejecuta línea por línea (Top-Down). No se reordenan.

### Condiciones

1. **Dado de Operaciones** → Comparador (`<` `≤` `≥` `>` `!=` `==`).
2. **1d6** → Valor del dado.
3. Elige un `numbers` → Valor del número.
4. Evalúa `(dado comparador numero)` → `TRUE` o `FALSE`.

**Interceptar.** Bot enemigo más cercano, 1 vez/turno. Sustituye el 1d6 por un `numbers` propio.

### Costes y Errores

- **`OVERLOAD`.** Sin `energy` → 1 `life` por punto faltante. Función **no se ejecuta**.
- **Sintaxis.** Error de regla o ejecución → 1 `BUG`.

/col

### Combate

- **Daño.** Daño ataque − `shield` defensor. Cada punto parado consume 1 `shield`.
- **Movimiento.** Hexes adyacentes. No atravesar obstáculos ni Bots.
- **Rango.** Hexes contiguos entre atacante y objetivo sin atravesar obstáculos/Bots.

## DEBUG() — Mantenimiento

Sin Operación, pagando Energía.

/json-sm tables/debug-functions.json

## END() — Fin del Ciclo

1. Descartar Operaciones. Conservar `numbers` y `energy`.
2. Turno al siguiente Programador → `COMPILE()`.
3. Todos activados → Nueva ronda → `INIT()`.
4. **Victoria.** Último con Bots operativos, o condición del escenario.

/end-col
