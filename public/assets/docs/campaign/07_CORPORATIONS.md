# CORP.DATA: Las Cinco Grandes

## Las Cinco Grandes Tecnológicas

Desde el Gran Reinicio, cinco corporaciones supervivientes aprendieron del colapso y ahora dominan el mundo. Una vez al año, sus mejores Programadores Senior se enfrentan en las Firmware Wars para resolver conflictos corporativos, saldar deudas de código y luchar por el estatus geopolítico.

En modo campaña, cada jugador elige **una corporación** antes de empezar. Esta elección determina el acceso a **4 funciones exclusivas** que ninguna otra corporación puede adquirir jamás.

---

## Funciones exclusivas — Reglas generales

- Las funciones de corpo se compran en el **MARKET.SYS** como cualquier otra función.
- Son **exclusivas** — solo la corporación correspondiente puede adquirirlas y usarlas.
- Se almacenan en el **Baúl** del Programador y pueden asignarse a cualquier Bot.
- Siguen las restricciones de versión habituales: una función V2 solo puede usarla un Bot que haya alcanzado la Versión 2 en ese escenario.

---

## 1. Helix Dynamics Group (HDG)

> *"La guerra es un problema de datos mal estructurados."*

**Origen:** Fusión de gigantes de datos, IA y redes neuronales. Empezaron organizando información; ahora optimizan la guerra.

**Arquetipo de juego:** Control e Información. Saber más que el rival y usar ese conocimiento para manipular sus condiciones antes de que pueda actuar.

| Función | V. | Coste | Energía | Efecto |
|---|---|---|---|---|
| `dataScan()` | 1 | 15◈ | 2 | Mira las Operaciones que el rival ha compilado este turno antes de que las ejecute. |
| `predictiveStrike()` | 2 | 25◈ | 3 | Si el rival tiene un `numbers` igual al dado lanzado en la condición, el ataque no puede ser interceptado. |
| `algorithmicJam()` | 2 | 30◈ | 4 | El rival debe descartar una Operación compilada de su elección antes de ejecutar `RUN()`. |
| `neuralOverride()` | 3 | 50◈ | 5 | Elige una Función del BattleScript compilado del rival. Esa Función no se ejecuta este turno. |

*HDG no ataca más fuerte, ataca más inteligente. Sus funciones desmontan la estrategia del rival antes de que pueda ejecutarla.*

---

## 2. Titan Industrial Solutions (TIS)

> *"Si puede entregarse en 24 horas, puede conquistarse en 24 horas."*

**Origen:** Empezaron moviendo paquetes. Ahora mueven ejércitos enteros.

**Arquetipo de juego:** Resistencia y Desgaste. Sobrevivir más, gastar menos, rendir indefinidamente.

| Función | V. | Coste | Energía | Efecto |
|---|---|---|---|---|
| `redundantSystem()` | 1 | 15◈ | 0 | Una vez por turno, si una Función no se ejecuta por falta de energía, no produce OVERLOAD. |
| `bulkRepair()` | 2 | 25◈ | 3 | Recupera 1 punto de `life` por cada BUG activo eliminado en esta fase `DEBUG()`. |
| `supplyDrop()` | 2 | 30◈ | 0 | Una vez por escenario, recupera 4 puntos de `energy` fuera de la fase `BOOT()`. |
| `massProduction()` | 3 | 50◈ | 6 | Si este Bot es destruido, vuelve al tablero en el Hex de despliegue inicial con `MAX_LIFE/2` al inicio de la siguiente ronda. Solo una vez por partida. |

*TIS no brilla, no sorprende. Simplemente no se detiene. Sus funciones están diseñadas para que el Bot siga operativo cuando todos los demás ya han caído.*

---

## 3. Aegis Crown Systems (ACS)

> *"La estabilidad requiere superioridad armada."*

**Origen:** El viejo complejo militar-industrial que sobrevivió a los estados.

**Arquetipo de juego:** Agresiva y Frontal. Armamento superior, líneas de fuego claras, superioridad letal.

| Función | V. | Coste | Energía | Efecto |
|---|---|---|---|---|
| `armorPiercing()` | 1 | 20◈ | 2 | El próximo ataque ignora el `shield` del defensor completamente. |
| `suppressiveFire()` | 2 | 25◈ | 3 | El objetivo no puede moverse durante su próximo turno. |
| `artilleryStrike()` | 2 | 35◈ | 5 | Ataque a rango 3–6 (SLDV) que hace 1d6 de daño a todos los Bots en R(1) del impacto. |
| `lockdownProtocol()` | 3 | 50◈ | 6 | Durante esta ronda, ningún Bot enemigo puede ejecutar `move()`. |

*ACS no improvisa. Cada función es una doctrina militar ejecutada con precisión. Sus funciones controlan el tablero mediante superioridad de fuego y negación de movimiento.*

---

## 4. NovaLife Biomechanics

> *"La carne es software heredado."*

**Origen:** De curar enfermedades a rediseñar al combatiente.

**Arquetipo de juego:** Soporte y Adaptación. El Bot no es una máquina, es un organismo que aprende y se regenera.

| Función | V. | Coste | Energía | Efecto |
|---|---|---|---|---|
| `cellularRegen()` | 1 | 15◈ | 2 | Al inicio de cada `BOOT()`, recupera 1 punto de `life` si `bugs` = 0. |
| `adaptiveShell()` | 2 | 25◈ | 3 | Tras recibir daño, `MAX_SHIELD` aumenta en 1 hasta el final de la ronda. Máximo +2 acumulable. |
| `viralPatch()` | 2 | 30◈ | 3 | Elimina 1 BUG propio e inyecta 1 BUG al Bot enemigo más cercano en rango 2. |
| `evolutionProtocol()` | 3 | 50◈ | 5 | El Bot gana +1 en una Constante a elegir hasta el final de la partida. No computa como Punto de Mejora de campaña. |

*NovaLife juega a largo plazo. Sus funciones acumulan ventajas progresivas que al final de la partida marcan la diferencia.*

---

## 5. Obsidian Finance & Security

> *"Si controlas la deuda, controlas la guerra."*

**Origen:** Nunca fabricaron nada. Poseen todo.

**Arquetipo de juego:** Élite y Sabotaje. Pocas acciones, máximo impacto. El rival paga el precio de existir.

| Función | V. | Coste | Energía | Efecto |
|---|---|---|---|---|
| `debtProtocol()` | 1 | 20◈ | 2 | El rival pierde 1d6 de `energy`. Si no tiene suficiente, pierde 1 `life` por cada punto que falta. |
| `blackMarketDeal()` | 2 | 30◈ | 0 | Una vez por escenario, usa cualquier función del Baúl del rival temporalmente durante este turno. |
| `hostileTakeover()` | 2 | 35◈ | 4 | El rival debe gastar 3 de `energy` adicional en su próxima Función o no puede ejecutarla. |
| `zeroDay()` | 3 | 50◈ | 6 | El Bot objetivo recibe 2 BUGs inmediatamente y no puede usar `DEBUG()` el próximo turno. |

*Obsidian no destruye Bots, destruye economías. Sus funciones atacan los recursos del rival — energía, operaciones, capacidad de recuperación — hasta que colapsa solo.*

---
