# Guía de Referencia Rápida

## INIT() — Inicio de Ronda

- **PPT Protocol:** Piedra-Papel-Tijera. Ganador obtiene **Prioridad de CPU**.
- El turno rota entre Programadores (un Bot cada uno) hasta completar todos.
- **Ronda 3** → `upgrade()` → `version` 2.
- **Ronda 5** → `upgrade()` → `version` 3.

---

## BOOT() — Simultáneo, todos los Bots

1. **Estado:** `life` ≤ 0 → Destruido. Limpiar efectos temporales expirados.
2. **Energía:** `getEnergy(n)` — Lanza nd6 (n = 1–3), suma a `energy`. Si supera `MAX_ENERGY` → `BUG`.
3. **Números:** `getNumbers()` — Rellena huecos vacíos de `numbers` con d6 hasta `MAX_NUMBERS`.
4. **Operaciones:** Lanza el Dado de Versión (V1/V2/V3) por cada ranura disponible (`MAX_OPERATIONS` − `bugs`). Solo 1 bucle (FOR o WHILE) por turno; si sale otro, relanzar.
5. **Mantenimiento directo:** Puede saltar a `DEBUG()` en vez de continuar con `COMPILE()`.

---

## COMPILE() — Programación

- Ordena las Operaciones en el Terminal. No es necesario usar todas.
- Asigna una Función (`COMMON.INTERFACE`) a cada Operación.
- Operaciones duales (`IF-ELSE`, `TRY-CATCH`): primaria obligatoria, secundaria opcional. No repetir la misma Función en ambas ranuras.

### COMMON.INTERFACE

/json tables/common-functions.json

---

## Operaciones

| Op. | Resolución |
|---|---|
| `IF` | TRUE → ejecuta función. FALSE → nada. |
| `IF-ELSE` | TRUE → ejecuta funcion IF. FALSE → ejecuta funcion ELSE. |
| `FOR` | 1d6 vs un `numbers`: la diferencia = repeticiones. Si > 3 o = 0 → `BUG`. |
| `WHILE` | Repite mientras TRUE (nueva condición por iteración). Si 0 ejecuciones → `BUG`. |
| `TRY-CATCH` | TRY falla por energía o BUG → ejecuta CATCH. Ninguna se ejecuta → `BUG`. |

/page

## RUN() — Ejecución

Ejecuta línea por línea, de arriba abajo. No se pueden reordenar.

### Resolución de Condiciones

1. Lanza **Dado de Operaciones** → comparador (`<` `≤` `≥` `>` `!=` `==`).
2. Lanza **1d6** → valor del dado.
3. Elige un número de `numbers` → valor del número.
4. Evalúa `(dado comparador numero)` → `TRUE` o `FALSE`.

#### Interceptar

El Bot enemigo **más cercano** puede interceptar **1 vez por turno**: sustituye el 1d6 de la condición por un valor de **su propia** reserva de `numbers`.

### Costes y Errores

- **`OVERLOAD`:** Sin `energy` suficiente → pierdes 1 `life` por punto faltante. La Función **no se ejecuta**.
- **Error de sintaxis:** Regla incorrecta o ejecución imposible → 1 `BUG`.

### Combate

- **Daño recibido:** Daño del ataque − `shield` del defensor. Cada punto parado consume 1 de `shield`.
- **Movimiento:** Solo Hexes adyacentes. No atravesar obstáculos ni Bots.
- **Rango:** Mínimo de Hexes contiguos entre atacante y objetivo sin atravesar obstáculos/Bots, salvo que el ataque indique lo contrario.

---

## DEBUG() — Mantenimiento

El Programador puede usar una o varias funciones, sin Operación, **pagando la Energía**.

/json tables/debug-functions.json

---

## END() — Fin del Ciclo

1. Descartar Operaciones ejecutadas.
2. Conservar `numbers` y `energy`.
3. Turno al siguiente Programador → su Bot inicia `COMPILE()`.
4. Todos los Bots activados → nueva ronda → `INIT()`.
5. **Victoria:** Último Programador con Bots operativos, o condición del escenario.

