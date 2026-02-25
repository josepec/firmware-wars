# CORE.CYCLE: Estructura del Turno

## Fases del Sistema

Cada ronda representa un ciclo de procesamiento compartido donde los Bots compiten por prioridad y recursos del sistema.

- **`INIT()`** — Inicio de ciclo, al inicio de ronda.
1. **`BOOT()`** — Secuencia de Inicialización del Sistema.
2. **`COMPILE()`** — Compilación del programa.
3. **`RUN()`** — Ejecución del código.
4. **`DEBUG()`** — Mantenimiento.
5. **`END()`** — Cierre y traspaso de turno.

---

## INIT()

Esta fase se realiza **una única vez al comienzo de cada ronda**, antes de que cualquier Bot ejecute su ciclo operativo. Representa la negociación global por el acceso al procesador central del campo de batalla y determina el orden de activación de los Programadores durante esa ronda.

### Negociación de CPU Time

1. Cada Programador lanza un mini-duelo de **Piedra-Papel-Tijera** (**PPT protocol**).
   - Gana el Programador que vence la jugada.
   - En caso de empate, repetir.
2. El ganador obtiene la **Prioridad de CPU** y uno de sus Bots empieza la fase de `BOOT()`. Una vez que el Bot complete todas las fases del turno, el turno pasa al siguiente Programador (p. ej., sentido horario). Este orden permanece fijo durante toda la ronda. Al finalizar todos los Bots, se inicia una nueva ronda y se vuelve a ejecutar `INIT()`.

---

## BOOT()

Cada Bot ejecuta su rutina de arranque y comprobación de integridad del sistema. Representa los **protocolos automáticos de diagnóstico y calibración** que preparan la unidad para un nuevo ciclo de combate.

### 1. Depuración de Efectos Temporales

- Se limpian todos los procesos de memoria volátil. Efectos temporales que hayan alcanzado el fin de su duración.
- Se aplican los posibles Efectos temporales que se activan durante la fase de `BOOT()`.

### 2. Chequeo de Estado

- Si el valor de `life` ≤ 0, el Bot se considera **destruido** y se apaga de manera irreversible. El procesador principal se apaga, y el cuerpo queda como chatarra sobre el campo de batalla.

### 3. Recuperación de Energía

- El Bot lanza el dado de energía asignado a su modelo (`ENERGY_DICE`), suma a esa tirada la versión del Bot (`version`) y recupera esa cantidad de puntos de **Energía**, sin superar su límite máximo (`MAX_ENERGY`).

### 4. Carga forzada de números

- Si el Bot no tiene ningún número (`numbers`) cargado en su memoria RAM, ejecuta de manera forzada e inmediatamente la función `getNumbers()`.

### 5. Carga de Operaciones del Turno

- Cada Bot tiene 3 Operaciones base por turno (`MAX_OPERATIONS`), pero por cada BUG activo (`bugs`), pierde una **ranura de ejecución**.
- El jugador tira un dado por cada ranura disponible. El dado a tirar depende de la versión:

**Versión V1 — 1d4**

| Tirada | Operación |
|---|---|
| 1 | IF |
| 2 | IF-ELSE |
| 3 | IF |
| 4 | IF-ELSE |

**Versión V2 — 1d4**

| Tirada | Operación |
|---|---|
| 1 | IF |
| 2 | IF-ELSE |
| 3 | FOR |
| 4 | WHILE |

**Versión V3 — 1d6**

| Tirada | Operación |
|---|---|
| 1 | IF |
| 2 | IF-ELSE |
| 3 | FOR |
| 4 | WHILE |
| 5 | TRY-CATCH |
| 6 | Vuelve a tirar |

> Solo se puede ejecutar un bucle FOR y un bucle WHILE por turno. Si ya ha salido uno, repite la tirada.

### 6. Mantenimiento Manual (opcional)

Si el Bot se encuentra **gravemente dañado o desestabilizado**, el programador puede omitir las fases operativas normales y dirigirlo directamente a la Fase `DEBUG()`. Esto representa una intervención manual para estabilizar el núcleo, reparar circuitos o purgar fallos críticos antes de volver al combate.

Durante este modo, el Bot **no ejecuta acciones ofensivas**, pero puede **recuperar vida, energía o eliminar BUGS**, según las reglas de mantenimiento aplicables.

---

## COMPILE()

Una vez completada la inicialización, el robot entra en la fase de programación del turno. El programador define el flujo lógico que el robot seguirá durante el ciclo actual. Esta fase **no ejecuta acciones**: simplemente prepara la secuencia de operaciones que se compilarán y ejecutarán en la fase `RUN()`.

### 1. Programación del Ciclo

- El programador toma las Operaciones obtenidas en `BOOT()` y las dispone en el orden deseado en su terminal. Cada línea de código representa una instrucción que el robot ejecutará en ese orden durante `RUN()`.
- No es necesario programar todas las operaciones. Si no se puede programar ninguna, se salta a `DEBUG()`.

### 2. Vinculación de Operaciones y Funciones

- No se puede ejecutar una **Función** fuera de una **Operación**. Algunas funciones como `IF-ELSE` o `TRY-CATCH` necesitan que se definan dos Funciones, una a cada lado de la condición.
- Los Bots tienen Funciones comunes (`COMMON.INTERFACE`) y funciones específicas del modelo.

Las **condiciones** se evalúan en tiempo de ejecución, en `RUN()`, y devuelven `TRUE` o `FALSE`. Los Bots utilizan sus **números** (`numbers`) guardados en los condicionales, obtenidos mediante `getNumbers()`.

### BattleScript

Una vez por turno, cada Bot ejecuta el siguiente bloque de código:

```
START
  //Operación 1
  //Operación 2
  //Operación 3
END
```

---

## Listado de Operaciones

### IF

- **Tipo:** Condicional simple
- **Condición TRUE:** Ejecuta Función
- **Condición FALSE:** No se ejecuta nada

```
IF (condición)
  THEN Función
```

Se puede utilizar para realizar acciones como ataques, movimiento, recarga, etc.

---

### IF-ELSE

- **Tipo:** Condicional dual
- **Condición TRUE:** Ejecuta FunciónA
- **Condición FALSE:** Ejecuta FunciónB

```
IF (condición)
  THEN FunciónA
  ELSE FunciónB
```

Se puede utilizar para realizar una segunda acción en caso que falle la principal. *Ejemplo: Intento atacar, pero si no puedo, recargo energía.*

---

### FOR

- **Tipo:** Bucle fijo
- **Limitación:** Solo se puede ejecutar uno por turno.
- **Resolución:** Elige un número guardado (valor máximo 3) — la función se ejecuta ese número de veces.
- **Bug:** Si el valor del número es superior a 3, se produce un **Infinite Loop**. No se ejecuta la operación y el Bot obtiene un BUG (`bugs`).

```
FOR (numero)
  Función
```

Se puede utilizar para realizar ataques múltiples, combos de movimiento o recargas intensas.

---

### WHILE

- **Tipo:** Bucle condicional
- **Limitación:** Solo se puede ejecutar uno por turno.
- **Condición TRUE:** Ejecuta Función y continúa otro Bucle más.
- **Condición FALSE:** No se ejecuta la Función y se detiene el Bucle.
- **Resolución:** Se comprueba la condición — cada Bucle genera una nueva condición.
- **Bug:** Si la Función no se ejecuta ni una sola vez, el Bot obtiene un BUG (`bugs`).

```
WHILE (condición)
  DO Función
```

Se puede utilizar para realizar una gran cantidad de ataques múltiples, combos de movimiento o recargas intensas. Con alto riesgo de sobrecarga.

---

### TRY-CATCH

- **Tipo:** Control de error
- **Resolución:**
  - Ejecuta una acción arriesgada. Si la Función no puede ejecutarse por falta de Energía u otros factores, se ejecuta la Función del `CATCH` (FunciónB).
  - Si la Función no se pudo ejecutar por falta de energía, **no** se produce Overload.
  - Si la acción es un `attack()` que no impacta y/o hace daño, se ejecuta la Función del `CATCH` (FunciónB).
  - La Función del `CATCH` **no está protegida** frente a Overload: se pierde un punto de `life` por cada punto que no se puede pagar. Además, no se ejecuta.
- **Bug:** Si no se ejecuta ninguna de las dos funciones, se produce una **Critical Exception**. El Bot obtiene un BUG (`bugs`).

```
TRY FunciónA
  CATCH FunciónB
```

Se puede utilizar para atacar o realizar acciones con seguridad.

---

## Listado de Funciones Comunes

### move()

- **Uso:** Recibe un valor numérico ≤ `MAX_MOVEMENT`. Mueve el Bot ese número de casillas.
- **Coste energético:** El valor numérico recibido.
- **Bug:** Si el valor supera `MAX_MOVEMENT`, la operación no se ejecuta y el Bot obtiene un BUG.

```
IF (1 < 2)
  THEN move(3)
```

---

### attack()

- **Uso:** Recibe como parámetro una función de **Callback** de ataque definida en el modelo del Bot. Se ejecutará tal y como esté definida.
- **Coste energético:** El valor energético definido en la función de ataque.
- **Detalles:** Costes, daño, alcance y efectos se encuentran en la sección **BOTS.CFG**.

```
IF (1 == 1)
  THEN attack(RocketPunch)
```

---

### getNumbers()

- **Uso:** Tira nd10 dados (siendo n el valor de `NDICES_NUMBERS` del modelo). Los resultados se almacenan en `numbers` para uso en condicionales.
- **Coste energético:** 0.
- **Detalles:** La cantidad de números no puede superar `MAX_NUMBERS`. Los números obtenidos después del máximo se descartan.

```
FOR (2)
  getNumbers()
```

---

### upgrade()

- **Uso:** Sube un punto la versión (`version`) del Bot.
- **Coste energético:** 15.
- **Detalles:** La versión máxima es 3 (`MAX_VERSION`). Subir versión da acceso a más Operaciones, Funciones y Ataques.

```
IF (5 != 2)
  THEN upgrade()
```

---

## RUN()

Una vez compilado el programa, comienza la fase de ejecución: el momento en que las órdenes escritas cobran vida y los robots despliegan su comportamiento sobre el campo de batalla.

Esta fase es donde **la estrategia y el caos se encuentran**. El código se transforma en acción, y la estrategia del programador se pone a prueba frente a la lógica implacable de las máquinas rivales.

### 1. Resolución de Instrucciones

El jugador debe ejecutar las **Operaciones** exactamente en el orden en que fueron programadas durante `COMPILE()`. Cada línea se interpreta y ejecuta de arriba abajo, como si el robot leyera su propio firmware línea por línea.

Durante esta fase, **no se pueden alterar ni reordenar las instrucciones ya compiladas**.

### 2. Verificación y Errores de Sintaxis

El resto de programadores **pueden detectar errores de código** en el programa visible en el terminal. Si una línea contiene un error — instrucción incompleta, mal expresada o imposible según las reglas — esa línea **no se ejecuta** y el Bot obtiene un BUG (`bugs`).

### 3. Ejecución de Operaciones

Para determinar el resultado de una condición:

```
(dado [comparador] numero)
```

1. Lanza el **Dado de operación** → define el comparador.
2. Elige uno de los números guardados (`numbers`) → define el numero.
3. Lanza **1d10** → define el dado.
4. Evalúa la condición: `TRUE` o `FALSE`.
5. Resuelve la Operación y ejecuta la Función si procede.

### 4. Coste Energético

Si no se puede pagar la energía (`energy`) de una función, se produce **Overload**: se pierde un punto de `life` por cada punto que no se puede pagar y la función **no se ejecuta**.

En Bucles, si en alguna iteración no se puede pagar el coste, esa iteración no se ejecuta, se produce Overload y el bucle se detiene.

---

### Movimiento

**Restricciones de desplazamiento.** Los Bots no pueden moverse a través de:

- Obstáculos (Hexes con la cara negra)
- Hexes ocupados por otros Bots (aliados o enemigos)

El desplazamiento debe realizarse siempre hacia Hexes adyacentes.

**Zonas de Amenaza.** Si al iniciar un movimiento el Bot se encuentra adyacente a uno o más Bots enemigos, el Bot recibe **2 puntos de Daño directo** al comenzar el movimiento (solo una vez, aunque haya varios enemigos).

---

### Combate

#### 1. Selección del Objetivo

El Programador elige un Bot dentro del **alcance en Hexes** especificado por su ataque.

Para validar el objetivo:

- Traza una **línea virtual** desde el centro del hexágono del Bot atacante hasta el centro del hexágono del objetivo.
- Si esa línea atraviesa un hexágono con un **obstáculo** (cara negra), el objetivo se considera oculto y no puede ser seleccionado. El jugador debe elegir otro objetivo válido o el ataque se cancela.

#### 2. Resolución del Combate

Ambos Bots realizan una **Tirada de Combate**:

- Bot Atacante: `1d6 + ATTACK_VALUE`
- Bot Defensor: `1d6 + ARMOR_VALUE`

| Resultado | Efecto |
|---|---|
| Atacante gana | El ataque se ejecuta con éxito. El objetivo pierde los puntos de daño del ataque. |
| Defensor gana | El ataque falla. |
| Empate | **EXCEPCIÓN CRÍTICA** — se resuelve con PPT protocol. |

**EXCEPCIÓN CRÍTICA — PPT protocol:**

- **Atacante gana** → el ataque tiene éxito y causa el **doble de daño**.
- **Defensor gana** → la acción es **deflectada**. La función de ataque se resuelve tratando al robot atacante como si fuera el objetivo.

---

## DEBUG()

La fase de depuración permite mantener a los robots operativos. El programador puede **depurar** su Bot gastando Energía. El programador puede realizar una o varias funciones, **siempre que pueda pagarlas**. Estas funciones no requieren ser ejecutadas dentro de Operaciones.

### Funciones de Mantenimiento

| Función | Coste | Efecto |
|---|---|---|
| `debug()` | 3 | Elimina **1 BUG** del Bot. |
| `patch()` | 8 | Elimina **todos** los BUGs. |
| `optimize()` | 5 | +1 a las tiradas de Energía durante el próximo turno. |
| `reboot()` | 0 | Pierde el próximo turno. Reinicia: `energy = 0`, `numbers = []`, `bugs = 0`. |

---

## END()

Esta fase ocurre cuando se completa el ciclo operativo del Bot. Aquí se liberan recursos, se estabiliza la memoria y se prepara el flujo para el siguiente programador.

1. **Descartar Operaciones Ejecutadas.** Todas las Operaciones utilizadas se eliminan del terminal. El robot limpia su pila de instrucciones para evitar residuo lógico.
2. **Conservar Números Guardados.** Los `numbers` almacenados en la RAM se mantienen activos para futuros turnos, salvo que algún efecto indique lo contrario.
3. **Transferencia del Turno.** El control pasa al siguiente jugador del orden de iniciativa, que inicia su ciclo desde `BOOT()`. Si todos los Bots han completado su ejecución, la ronda concluye.
4. **Fin de Ronda.** Se vuelve a la fase `INIT()`, reiniciando el ciclo completo del sistema.
