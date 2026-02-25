# TECHNICAL.REF

## 8.1 Ciclo de Turno

| Fase | Momento | Acciones Clave |
|---|---|---|
| `INIT()` | Inicio de Ronda (una vez) | Negociación de CPU Time (PPT protocol) para determinar el orden de activación. |
| `BOOT()` | Inicio de Ronda (una vez) | Recuperación de Energía, Carga de Operaciones y Depuración de Efectos Temporales. |
| `COMPILE()` | Ciclo del Bot | Programador ordena las Operaciones en el Terminal. Asigna Funciones y prepara el código. |
| `RUN()` | Ciclo del Bot | Ejecución de Operaciones y Funciones. Resolución de ataques, condiciones y costes energéticos. |
| `DEBUG()` | Ciclo del Bot (Opcional) | Intervención manual: omite `RUN()`. Permite ejecutar Funciones de Mantenimiento. |
| `END()` | Fin del Ciclo del Bot | Descarte de Operaciones. Conservación de Números y Energía. Transferencia del turno. |

---

## 8.2 Operaciones Disponibles por Versión

| Versión | Operaciones Permitidas | Límite de Bucle | Notas |
|---|---|---|---|
| V1 | IF, IF-ELSE | — | Condicionales básicos. |
| V2 | IF, IF-ELSE, FOR, WHILE | 1 FOR ó 1 WHILE | Condicionales y pequeña lógica. |
| V3 | IF, IF-ELSE, FOR, WHILE, TRY-CATCH | 1 FOR ó 1 WHILE | Condicionales y lógica avanzada. |

---

## 8.3 Consecuencias por Fallo de Código

| Error | Función/Operación | Consecuencia |
|---|---|---|
| Infinite Loop | `FOR` | Si el número guardado es > 3, la operación no se ejecuta y se obtiene 1 BUG. |
| Bucle Fallido | `WHILE` | Si la Función no se ejecuta ni una sola vez, se obtiene 1 BUG. |
| Critical Exception | `TRY-CATCH` | Si ninguna de las dos Funciones llega a ejecutarse, se obtiene 1 BUG. |
| Error de Sintaxis | `RUN()` | Si el resto de Programadores detectan una instrucción imposible, no se ejecuta y el Bot obtiene 1 BUG. |
| Movimiento Excedido | `move()` | Si el parámetro numérico es > `MAX_MOVEMENT`, la operación no se ejecuta y se obtiene 1 BUG. |

---

## 8.4 Variables de Estado del Bot

| Variable | Tipo | Propósito y Uso |
|---|---|---|
| `life` | Numérico | Puntos de vida actuales. Si ≤ 0, el Bot está destruido. |
| `energy` | Numérico | Puntos de Energía actuales. Se consume con funciones, se recupera en `BOOT()`. |
| `shield` | Numérico | Puntos de Escudo actuales. Se consume para evitar daño (1 escudo por 1 daño). |
| `version` | Numérico (1-3) | Nivel de versión del Bot. Determina Operaciones y Ataques disponibles. |
| `bugs` | Numérico | Fallos de código activos. Cada BUG resta una ranura de ejecución. |
| `numbers` | Array (d10) | Números almacenados en memoria RAM, usados para condiciones. |
| `max_numbers` | Numérico | Capacidad máxima del array `numbers`. V1→5, V2→7, V3→8. |
| `ENERGY_DICE` | Constante | Tipo de dado para la recuperación de energía. |
| `MAX_LIFE` | Constante | Límite máximo de Vida. |
| `MAX_ENERGY` | Constante | Límite máximo de Energía. |
| `MAX_SHIELD` | Constante | Límite máximo de Escudo. |
| `MAX_MOVEMENT` | Constante | Número máximo de Hexes por `move()`. |
| `MAX_VERSION` | Constante (3) | Máxima versión alcanzable con `upgrade()`. |
| `MAX_OPERATIONS` | Constante (3) | Capacidad máxima de Operaciones por turno. |

---

## 8.5 Funciones del Sistema (SYSTEM.INTERFACE)

| Función | Efectos y Reglas |
|---|---|
| `getNumbers()` | Tira nd10 y almacena los resultados en `numbers`, hasta llenar `MAX_NUMBERS`. |
| `upgrade()` | Sube la `version` del Bot en 1 punto, hasta `MAX_VERSION` (3). |

---

## 8.6 Funciones Comunes (COMMON.INTERFACE)

| Función | Energía | Efectos y Reglas |
|---|---|---|
| `move(valor)` | valor | Mueve el Bot hasta `valor` Hexes. `valor` debe ser ≤ `MAX_MOVEMENT`. Si es mayor, se genera un BUG. |
| `attack(FunciónAtaque)` | FunciónAtaque | Ejecuta una Función de ataque específica del modelo de Bot. |
| `shield()` | 2 | Añade un punto de Escudo en `shield`, sin superar `MAX_SHIELD`. |

---

## 8.7 Funciones Mantenimiento (DEBUG.INTERFACE)

| Función | Energía | Efecto en Fase DEBUG() |
|---|---|---|
| `debug()` | 3 | Elimina 1 Bug de los `bugs` activos. |
| `patch()` | 8 | Elimina todos los `bugs` activos. |
| `optimize()` | 5 | +1 a las tiradas de Energía durante el próximo turno. |
| `reboot()` | 0 | Pierde el próximo turno. Reinicia `energy=0`, `numbers=[]`, `bugs=0`. |

---

## 8.8 Funciones Ataque/Especiales

| Función | V. | Rango | Daño | Energía | Efectos |
|---|---|---|---|---|---|
| `PowerSmash()` | 1 | 1 | 2 | 3 | Empuja al objetivo 1 Hex. |
| `RocketPunch()` | 1 | 1 | 1d4 | 4 | Ninguno. |
| `LaserBeam()` | 1 | 8 | 2 | 3 | Ataque en línea recta. |
| `DashStrike()` | 1 | 2 | 2 | 3 | Puede mover 1 Hex después de atacar. |
| `PinpointBurst()` | 1 | 4 | 2 | 2 | Ataque en línea recta. |
| `PulseShot()` | 1 | 2 | 2 | 1 | Si objetivo está a 1 Hex → +1 daño. |
| `StabilizerHit()` | 1 | 1 | 1 | 1 | Superar 1d6 (>3) o recibe LAG (-1 MAX_MOVEMENT). |
| `NanoRepair()` | 2 | — | — | 4 | El Bot recupera 1d4 puntos de Vida. |
| `TraceShot()` | 2 | 6 | 1d4 | 4 | Sin línea visual, solo requiere rango. |
| `GhostProtocol()` | 2 | 2 | 0 | 3 | Objetivo recibe 1 BUG y pierde hasta 2 `numbers`. |
| `ShadowStep()` | 2 | — | — | 3 | Se teleporta 3 Hexes ignorando obstáculos. |
| `OverdriveStrike()` | 3 | 1 | * | * | Gasta toda la Energía (min 2). 1 daño por cada 2 Energías. |
| `ChargedStrike()` | 3 | 1 | charge | 0 | Daño igual al valor acumulado de `charge`. |
| `DataSpike()` | 3 | 2 | 1d8 | 6 | El objetivo recibe 1 BUG. |
| `FlashSpin()` | 3 | * | 1 | 2 | Área Hexes adyacentes. Daño 1 a todos los Bots en alcance. |
| `SyncBlast()` | 3 | 1 | 3 | 3 | Si `energy` ≥ 10 al declarar: +1 a la Tirada de Combate. |
| `RelayNode()` | 3 | — | — | 2 | Despliega Nodo (Vida 2, Máx 3). Inflige 2 daño a Bots adyacentes en `BOOT()`. |
| `NovaBlast()` | 3 | 5 | 1d10 | 6 | Genera 1 BUG al usuario por el retroceso. |
| `EMP_Field()` | 3 | 5 | 1d6 | 6 | Área Rango 1. Bots deben superar 1d6 (>3) o reciben estado DMZ. |

---

## 8.9 Funciones Pasivas (Background Daemon Ext.)

| Función | Efectos |
|---|---|
| `ReinforcedChassis()` | El Bot aumenta su `shield` en +1 de forma permanente. |
| `EnergyRecycler()` | Cada vez que el Bot dañe a un enemigo, recupera 1 de `energy` inmediatamente. |
| `BufferedMemory()` | El Bot ignora el primer BUG que reciba en cada turno. |
| `ReactiveServos()` | Si un enemigo falla un ataque, el Bot puede moverse 1 Hex gratis. |
| `ReactiveLogic()` | Si un Bot se destraba, recibe 1 de Daño. |
| `CriticalEvasion()` | El Bot puede esquivar el daño. Debe superar 1d6 (>4); si falla recibe el doble de daño. |

---

## 8.10 Estados Alterados

| Estado | Efecto en el Bot |
|---|---|
| `LAG` | Pierde 1 punto de `MAX_MOVEMENT` durante el turno actual. |
| `SAFE_MODE` | El Bot es inmune a recibir nuevos BUGS hasta el inicio de su próximo turno. |
| `DMZ` | El Bot no puede ejecutar funciones de ataque durante el próximo turno. |
| `REBOOTING` | El Bot se está reiniciando y pierde el próximo turno. |
