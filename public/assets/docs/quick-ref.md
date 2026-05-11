# Guía de Referencia Rápida

/two-col

## INIT() — Inicio de Ronda

- **PPT Protocol.** Piedra-Papel-Tijera.<br> Ganador → **Prioridad de CPU**.
- Turno rota entre Programadores (un Bot cada uno).
- **Ronda 3** → `upgrade()` → `version` 2.
- **Ronda 5** → `upgrade()` → `version` 3.

## BOOT() — Simultáneo

1. **Estado.** `life` ≤ 0 → Destruido. Limpiar efectos temporales.
2. **Energía.** `getEnergy(n)` — nd6 (n=0–3), suma a `energy`.<br> Si > `MAX_ENERGY` → `BUG`.
3. **Números.** `getNumbers()` — Rellena `numbers` con d6 hasta `MAX_NUMBERS`.
4. **Operaciones.** Dado de Versión × ranura (`MAX_OPERATIONS` − `bugs`). Solo 1 bucle/turno.
5. Puede saltar directo a `DEBUG()`.

/col
## COMPILE()

- Ordenar Operaciones en Terminal. No es necesario usar todas.
- Asigna Función a cada Operación.
- Duales (`IF-ELSE`, `TRY-CATCH`): Primaria obligatoria, secundaria opcional. No repetir Función.

### Operaciones

| Op. | Resolución |
|---|---|
| `IF` | TRUE → Ejecuta Función. FALSE → Nada. |
| `IF-ELSE` | TRUE → Ejecuta Func. IF. FALSE → Ejecuta Func. ELSE. |
| `FOR` | 1d6 vs un `numbers`: la diferencia = repeticiones.<br> Si > 3 o = 0 → `BUG`. |
| `WHILE` | Repite mientras TRUE (nueva condición por iteración).<br> Si 0 ejecuciones → `BUG`. |
| `TRY-CATCH` | TRY falla por energía o BUG → ejecuta CATCH. <br> Si ninguna se ejecuta → `BUG`. |

/end-col

### COMMON.INTERFACE

/json tables/common-functions.json

/page
/two-col

## RUN()

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

### Combate

- **Daño.** Daño ataque − `shield` defensor. Cada punto parado consume 1 `shield`.
- **Movimiento.** Hexes adyacentes. No atravesar obstáculos ni Bots.
- **Rango.** Hexes contiguos entre atacante y objetivo sin atravesar obstáculos/Bots.

/col

## DEBUG()

Sin Operación, pagando Energía.

/json-sm tables/debug-functions.json

## END()

1. Descartar Operaciones. Conservar `numbers` y `energy`.
2. Turno al siguiente Programador → `COMPILE()`.
3. Todos activados → Nueva ronda → `INIT()`.
4. **Victoria.** Último con Bots operativos, o condición del escenario.

/img-center /assets/img/t-rex-robot.png print-only

/end-col
