# CORE.CYCLE: Turno

## Fases del Sistema

Cada ronda representa un ciclo de procesamiento compartido donde los Bots compiten por prioridad y recursos del sistema.

**Inicio de ronda:**
1. **`INIT()`** — Se determina el **orden de activación** de los Programadores. El turno rota entre jugadores (un Bot cada uno) hasta completar todos los Bots. Los Bots mejoran en las rondas 3 y 5.
2. **`BOOT()`** — Los Bots arrancan, recuperan Energía, cargan **Operaciones** aleatorias del sistema y limpian **efectos temporales**.

**Ciclo de Bot:**
1. **`COMPILE()`** — El Programador ordena sus **Operaciones** y define qué **Funciones** ejecutará cada una.
2. **`RUN()`** — El código se ejecuta línea por línea. Los condicionales se resuelven con dados, la energía se consume, los ataques impactan.
3. **`DEBUG()`** — Mantenimiento opcional: Permite purgar **Bugs**, recuperar el sistema y reparar el núcleo.
4. **`END()`** — Se descartan Operaciones, se conserva la memoria y la energía. El turno pasa al siguiente Bot o termina la ronda. Si se cumplen las condiciones de victoria, termina la partida.

---

## INIT()

Esta fase se realiza **una única vez al comienzo de cada ronda**, antes de que cualquier Bot ejecute su ciclo operativo. Representa la negociación global por el acceso al procesador central del campo de batalla y determina el orden de activación de los Programadores durante esa ronda.

### Negociación de CPU Time

1. Cada Programador lanza un mini-duelo de **Piedra-Papel-Tijera** (**PPT protocol**).
   - Gana el Programador que vence la jugada.
   - En caso de empate, repetir.
2. El ganador obtiene la **Prioridad de CPU** y uno de sus Bots comenzará su ciclo después de la fase de `BOOT()`. Una vez que el Bot complete todas las fases del turno, el turno pasa al siguiente Programador (siguiendo el sentido horario). El turno rota de forma individual (un Bot por jugador) hasta que todas las unidades hayan actuado. Este orden permanece fijo durante toda la ronda. Al finalizar todos los Bots, se inicia una nueva ronda y se vuelve a ejecutar `INIT()`.
3. Al inicio de los siguientes turnos, se produce un upgrade() de todos los Bots:
 - Ronda 3 → Ejecución de `upgrade()` → Todos los Bots pasan a `version` 2.
 - Ronda 5 → Ejecución de `upgrade()` → Todos los Bots pasan a `version` 3.


---

## BOOT()

Todos los Programadores ejecutan la secuencia de `BOOT()` de forma simultánea en todas sus unidades.

Cada Bot ejecuta su rutina de arranque y comprobación de integridad del sistema. Representa los **protocolos automáticos de diagnóstico y calibración** que preparan la unidad para un nuevo ciclo de combate.

### 1. Chequeo de Estado

- Si el valor de `life` ≤ 0, el Bot se considera **destruido** y se apaga de manera irreversible. El procesador principal se apaga, y el cuerpo queda como chatarra sobre el campo de batalla (obstáculo).

### 2. Depuración de Efectos Temporales

- Se limpian todos los procesos de memoria volátil. Efectos temporales que hayan alcanzado el fin de su duración.
- Se aplican los posibles Efectos temporales que se activan durante la fase de `BOOT()`.

### 3. Recuperación de Energía

- El Bot ejecuta `getEnergy(n)`: Lanza nd6, siendo n del 1 al 3, y almacena la Energía obtenida en `numbers`. Si la Energía total es mayor que tu `MAX_ENERGY`, el Bot no puede procesar el exceso: ignora la energía excedente y recibe automáticamente un `BUG` por sobrecarga.

### 4. Carga de números en RAM

- El Bot ejecuta `getNumbers()`: Lanza tantos dados (d6) como espacios vacíos queden en su reserva de `numbers` hasta alcanzar el límite de `MAX_NUMBERS`. 

> Cada resultado obtenido se almacena en el terminal (colocando el dado físicamente o anotando su valor). 

### 5. Carga de Operaciones del Turno

- Cada Bot tiene 3 Operaciones base por turno `MAX_OPERATIONS`, pero por cada `BUG` activo en `bugs`, pierde una Operación.
- Cada Operación requiere el lanzamiento de un dado. El dado utilizado depende directamente de la `version` del Bot (V1, V2 o V3). Utiliza el dado correspondiente a la `version` de tu Bot (Dado V1, Dado V2 o Dado V3). Si no dispones de los dados específicos, puedes utilizar un 1d6 consultando la Tabla de Equivalencias que figura a continuación:

| Resultado | V1 | V2 | V3 |
|---|---|---|---|
| 1 | IF | IF | IF |
| 2 | IF-ELSE | IF-ELSE | IF-ELSE |
| 3 | IF | FOR | FOR |
| 4 | IF-ELSE | WHILE | WHILE |
| 5 | IF | FOR | TRY-CATCH |
| 6 | IF-ELSE | WHILE | TRY-CATCH |

> Solo un bucle (FOR o WHILE) por turno. Si ya ha salido uno, vuelve a tirar.

### 6. Mantenimiento Manual (opcional)

Si el Bot se encuentra **gravemente dañado o desestabilizado**, el programador puede omitir las fases operativas normales y dirigirlo directamente a la Fase `DEBUG()`. Esto representa una intervención manual para estabilizar el núcleo, reparar circuitos o purgar fallos críticos antes de volver al combate.

Durante este modo, el Bot **no ejecuta acciones ofensivas**, pero puede **recuperar vida, energía o eliminar BUGS**, según las reglas de mantenimiento aplicables.

### 7. Fin de fase

Al terminar esta fase, el Programador con la **Prioridad de CPU** inicia el **Ciclo de Bot** en uno de sus Bots. El **Ciclo de Bot** comienza con la fase de `COMPILE()`.

---

## COMPILE()

Una vez completada la inicialización, el robot entra en la fase de programación del turno. El programador define el flujo lógico que el robot seguirá durante el ciclo actual. Esta fase **no ejecuta acciones**: simplemente prepara la secuencia de operaciones que se compilarán y ejecutarán en la fase `RUN()`.

### 1. Programación del Ciclo

- El programador toma las Operaciones obtenidas en `BOOT()` y las dispone en el orden deseado en su terminal. Cada línea de código representa una instrucción que el robot ejecutará en ese orden durante `RUN()`.
- No es necesario programar todas las operaciones. Si no se puede programar ninguna, se salta a `DEBUG()`.

> Puedes utilizar las Tarjetas de Operación en vez de escribir el código con las Operaciones. 

### 2. Vinculación de Operaciones y Funciones

Toda **Función** requiere una **Operación** para ser procesada; **no es posible ejecutar funciones de forma aislada**. La mayoría de las **Operaciones** permiten alojar una única **Función**, pero algunas **Operaciones** como `IF-ELSE` o `TRY-CATCH` poseen dos ranuras de ejecución (una para cada rama de la condición) 
 - **Ranura Primaria:** Es de uso Obligatorio.
 - **Ranura Secundaria:** Es de uso Opcional.
 - **Restricción de Duplicado:** Bajo ninguna circunstancia se puede asignar la misma Función a ambas ranuras de una misma Operación.

Los Bots tienen Funciones comunes (`COMMON.INTERFACE`) y Funciones elegidas durante la construcción.

Las **condiciones** se evalúan en tiempo de ejecución, en `RUN()`, y devuelven `TRUE` o `FALSE`. Los Bots utilizan sus **números** (`numbers`) guardados en los condicionales, obtenidos mediante `getNumbers()`.

### BattleScript

/img-center /assets/img/battleScript.png print

Una vez por turno, cada Bot ejecuta el siguiente bloque de código:

```bs
START
  //Operación 1
  //Operación 2
  //Operación 3
END
```

> **Recuerda:** Cada Bot tiene 3 Operaciones base por turno `MAX_OPERATIONS`, pero por cada `BUG` activo en `bugs`, pierde una Operación.

---

## Listado de Operaciones

> Las condiciones de las Operaciones se determinan en la fase de `RUN()`.

### IF

- **Tipo:** Condicional simple
- **Condición TRUE:** Ejecuta `funcion()`
- **Condición FALSE:** No se ejecuta nada

```bs
IF (condición)
  THEN funcion()
```

Se puede utilizar para realizar acciones como ataques, movimiento, escudo, etc.

---

### IF-ELSE

- **Tipo:** Condicional dual
- **Condición TRUE:** Ejecuta `funcionA()`
- **Condición FALSE:** Ejecuta `funcionB()`

```bs
IF (condición)
  THEN funcionA()
  ELSE funcionB()
```

Se puede utilizar para realizar una segunda acción en caso que falle la principal. 
> Ejemplo: Intento atacar, pero si no puedo, genero escudo.

---

### FOR

- **Tipo:** Bucle fijo
- **Limitación:** Solo se puede ejecutar un Bucle por turno (`FOR` o `WHILE`).
- **Resolución:** Determinar `numero`. **Primero** se lanza 1d6 y **después** el Programador elige un número guardado en `numbers`. La **diferencia entre ambos números** (restando el menor al mayor) define el valor de `numero`. Esa será la cantidad de veces que se ejecute la Función.
- **Bug:** Si el valor del número es **superior a 3 o es igual a 0**, se produce un **Infinite Loop**. No se ejecuta la operación y el Bot obtiene un `BUG` en `bugs`.

```bs
FOR (numero)
  funcion()
```

Se puede utilizar para realizar ataques múltiples, combos de movimiento o una gran generación de escudo.

---

### WHILE

- **Tipo:** Bucle condicional
- **Limitación:** Solo se puede ejecutar un Bucle por turno (`FOR` o `WHILE`).
- **Condición TRUE:** Ejecuta `funcion()` y continúa otro Bucle más.
- **Condición FALSE:** No se ejecuta `funcion()` y se detiene el Bucle.
- **Resolución:** Se comprueba la condición — cada Bucle genera una nueva condición.
- **Bug:** Si la Función **no se ejecuta ni una sola vez**, el Bot obtiene un `BUG` en `bugs`.

```bs
WHILE (condición)
  DO funcion()
```

Se puede utilizar para realizar una gran cantidad de ataques múltiples, combos de movimiento o grandes escudos. Con alto riesgo de sobrecarga.

---

### TRY-CATCH

- **Tipo:** Control de error
- **Resolución:**
  - Ejecuta una acción arriesgada. Si `funcionA()` no puede ejecutarse por falta de Energía u otros factores, se ejecuta `funcionB()`.
  - Si la Función del `TRY` no se pudo ejecutar por falta de energía, **no** se produce `OVERLOAD`. Se ejecuta `CATCH`.
  - Si la Función del `TRY` va a generar un `BUG` al ejecutarse, no se ejecuta. Se ejecuta `CATCH`.
  - La Función del `CATCH` **no está protegida** frente a `OVERLOAD` o `BUG`.
- **Bug:** Si no se ejecuta ninguna de las dos funciones, se produce una **Critical Exception**. El Bot obtiene un `BUG` en `bugs`.

```bs
TRY funcionA()
  CATCH funcionB()
```

Se puede utilizar para atacar o realizar acciones con seguridad.

---

## Listado de Funciones Comunes

Todos los Bots tienen acceso a las Funciones Comunes `COMMON.INTERFACE` para poder usarlas en sus Operaciones.

### move()

- **Uso:** Recibe un valor numérico ≤ `MAX_MOVEMENT`. Mueve el Bot ese número de casillas.
- **Coste energético:** El valor numérico recibido.
- **Bug:** Si el valor numérico supera `MAX_MOVEMENT`, la operación no se ejecuta y el Bot obtiene un `BUG`.

```bs
IF (condición)
  THEN move(3)
```

> El valor numérico se ha establecido en la fase de `COMPILE()`. Este número **no pertenece a la reserva de `numbers`**.

---

### attack()

- **Uso:** Recibe como parámetro una función de **Callback** de ataque configurada en el Bot. Se ejecutará tal y como esté definida.
- **Coste energético:** El valor energético definido en la función de ataque.
- **Detalles:** El coste, daño, rango y efectos se encuentran en la sección **BOTS.CFG**.

```bs
IF (condición)
  THEN attack(rocketPunch())
```

---

### shield()

- **Uso:** Añade un punto a `shield` siempre que `shield` < `MAX_SHIELD`.
- **Coste energético:** 2.

```bs
IF (condición)
  THEN shield(3)
```

> El valor de `shield` se descuenta del daño causado por un ataque y se pierde.

---

## Listado de Funciones del Sistema

Los Bots tienen acceso a las Funciones del Sistema `SYSTEM.INTERFACE` pero **no pueden usarlas en sus Operaciones**. Estas Funciones se llaman automáticamente en diferentes Fases del Sistema y no tienen Coste Energético.

### getEnergy(n)

- **Uso:** Tira nd6, siendo n del 1 al 3, y almacena la Energía en `numbers`, hasta llenar `MAX_ENERGY`.
- **Cuando:** En la fase de `BOOT()`.
- **Detalles:** La cantidad de energía no puede superar `MAX_NUMBERS`, descarta toda la energía que lo supere. Si con el resultado de la tirada se sobrepasaba `MAX_ENERGY` se genera un `BUG`.

---

### getNumbers()

- **Uso:** Lanza tantos dados (d6) como espacios vacíos queden en su reserva de `numbers` hasta alcanzar el límite de `MAX_NUMBERS`.
- **Cuando:** En la fase de `BOOT()`.
- **Detalles:** La cantidad de números no puede superar `MAX_NUMBERS`.

---

### upgrade()

- **Uso:** Sube un punto la versión `version` del Bot.
- **Cuando:** En la fase de `INIT()`, rondas 3 y 5.
- **Detalles:** La versión máxima es 3 (`MAX_VERSION`). Subir versión da acceso a más Operaciones, Funciones y Ataques.

---

## RUN()

Una vez compilado el programa, comienza la fase de ejecución: el momento en que las órdenes escritas cobran vida y los robots despliegan su comportamiento sobre el campo de batalla.

Esta fase es donde **la estrategia y el caos se encuentran**. El código se transforma en acción, y la estrategia del programador se pone a prueba frente a la lógica implacable de las máquinas rivales.

### 1. Resolución de Instrucciones

El jugador debe ejecutar las **Operaciones** exactamente en el orden en que fueron programadas durante `COMPILE()`. Cada línea se interpreta y ejecuta de arriba abajo, como si el robot leyera su propio firmware línea por línea.

Durante esta fase, **no se pueden alterar ni reordenar las instrucciones ya compiladas**.

### 2. Verificación y Errores de Sintaxis

El resto de programadores **pueden detectar errores de código** en el programa visible en el terminal. Si una línea contiene un error — instrucción incompleta, mal expresada o imposible según las reglas — esa línea **no se ejecuta** y el Bot obtiene un `BUG` en `bugs`.

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

Si no se puede pagar la energía (`energy`) de una función, se produce `OVERLOAD`: se pierde un punto de `life` por cada punto que no se puede pagar y la función **no se ejecuta**.

En Bucles, si en alguna iteración no se puede pagar el coste, esa iteración no se ejecuta, se produce `OVERLOAD` y el bucle se detiene.

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
| `debug()` | 3 | Elimina 1 `BUG` del Bot. |
| `patch()` | 8 | Elimina **todos** los `bugs`. |
| `optimize()` | 5 | +1 a las tiradas de Energía durante el próximo turno. |
| `reboot()` | 0 | Pierde el próximo turno. Reinicia: `energy = 0`, `numbers = []`, `bugs = 0`. |

---

## END()

Esta fase ocurre cuando se completa el ciclo operativo del Bot. Aquí se liberan recursos, se estabiliza la memoria y se prepara el flujo para el siguiente programador.

1. **Descartar Operaciones Ejecutadas.** Todas las Operaciones utilizadas se eliminan del terminal. El robot limpia su pila de instrucciones para evitar residuo lógico.
2. **Conservar Números Guardados.** Los `numbers` almacenados en la RAM se mantienen activos para futuros turnos, salvo que algún efecto indique lo contrario.
3. **Transferencia del Turno.** El control pasa al siguiente jugador del orden de iniciativa, que inicia su ciclo desde `BOOT()`. Si todos los Bots han completado su ejecución, la ronda concluye.
4. **Fin de Ronda.** Se vuelve a la fase `INIT()`, reiniciando el ciclo completo del sistema.
