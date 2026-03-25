## Decisiones Corporativas

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

> BACKDOOR ALLIANCE tiene prioridad sobre cualquier otro final si se activa correctamente.

---

## Umbrales de Puntos de Mejora

| Punto de Mejora | XP acumulado necesario | Dificultad real |
|---|---|---|
| 1º | 3 XP | Moderada — hacia el escenario 3–4 |
| 2º | 7 XP | Alta — requiere sobrevivir bien y conseguir algún tesoro |
| 3º | 12 XP | Excepcional — campaña casi perfecta |

> El XP máximo teórico en una campaña completa es **13 XP** (10 escenarios + 3 tesoros). El 3er Punto de Mejora es alcanzable pero solo para el Programador que juega una campaña prácticamente perfecta — ninguna baja, todos los tesoros recogidos.

---

## XP máximo realista

| Escenario | XP por supervivencia | XP por tesoro | Total acumulable |
|---|---|---|---|
| Acto I (3 escenarios) | 3 XP | Hasta 1 XP | 4 XP |
| Acto II (3 escenarios) | 3 XP | Hasta 1 XP | 4 XP |
| Acto III (4 escenarios) | 4 XP | Hasta 1 XP | 5 XP |
| **Total campaña** | **10 XP** | **3 XP** | **13 XP** |

Un Bot que muere ocasionalmente y recoge 1–2 tesoros llegará a **7–9 XP** — suficiente para el 2º Punto de Mejora con algo de esfuerzo.

---

### Narrativa de las reparaciones

**Acto I:** Eres el representante de tu corporación en fase de clasificación. La empresa tiene interés en que llegues en plena forma — cubre todas las reparaciones porque eres su inversión.

**Acto II:** Sigues bajo el paraguas corporativo pero operas con recursos más limitados. La empresa cubre el soporte básico — una unidad por escenario. El resto va a tu cuenta.

**Acto III:** A este nivel del torneo los Programadores operan con mayor autonomía pero también mayor riesgo personal. La corporación ha cumplido su parte.

> *"Enhorabuena, Programador. Has superado la fase de clasificación. A partir de ahora, la Corporación considera que tus activos son tu responsabilidad. El soporte técnico básico cubre una unidad por escenario. El resto... corre de tu cuenta."*

---


## Simulación económica de referencia

Para un jugador de rendimiento medio en una campaña completa (6 victorias, 4 derrotas, alguna baja ocasional, 1 objetivo secundario por escenario de media):

| Concepto | Total estimado |
|---|---|
| Resultados de combate | ~250◈ |
| Objetivos secundarios | ~56◈ |
| **Total ganado** | **~306◈** |
| Reparaciones Acto II–III (~3 bajas extra) | ~75◈ |
| Funciones compradas (2V1 + 1V2 + 1V3) | ~120◈ |
| **Total gastado** | **~195◈** |
| **Remanente estimado** | **~110◈** |

> Un jugador con mala racha (muchas derrotas y bajas) puede quedarse con ~50◈ de remanente. Un jugador excelente puede acumular hasta ~200◈. El sistema está calibrado para que siempre haya decisiones económicas reales que tomar.

## Nodos de Datos

A lo largo de la campaña hay **3 escenarios** que contienen un **Nodo de Datos** — un tesoro que otorga **1 XP** al Bot que lo recoge. Su posición en el tablero es pública y conocida desde el inicio del escenario.

Los escenarios que contienen Nodo de Datos están indicados en su ficha correspondiente.

---

## Tipos de Nodo

### Nodo Fijo
Colocado en un Hex específico al construir el tablero, visible desde el primer turno. La tensión no viene de la sorpresa sino de la disputa por llegar primero.

### Nodo Custodiado *(a partir del Acto II)*
Algunos escenarios incluyen un **Bot Centinela** neutral que custodia el Nodo. El Nodo solo es recogible una vez que el Centinela es eliminado. Cualquier jugador puede eliminarlo — lo que añade la posibilidad de que uno haga el trabajo sucio y el otro llegue a recoger el XP.

**Stats del Centinela:**

| Variable | Valor |
|---|---|
| MAX_LIFE | 6 |
| MAX_ENERGY | 6 |
| MAX_SHIELD | 0 |
| MAX_MOVEMENT | 2 |

El Centinela sigue su propio flowchart de IA simple: si hay un Bot a rango 1, ataca con su función base; si no, permanece inmóvil custodiando el Nodo.

---

## Distribución de Nodos en la campaña

| Acto | Escenarios con Nodo | Tipo |
|---|---|---|
| Acto I | 1 escenario | Fijo |
| Acto II | 1 escenario | Custodiado |
| Acto III | 1 escenario | Fijo o Custodiado (según escenario) |
| **Total campaña** | **3 Nodos** | — |

> Los escenarios concretos que contienen Nodo de Datos están indicados en sus fichas.

---

## Stats de los ROGUE.EXE

| Variable | Valor |
|---|---|
| MAX_LIFE | 8 |
| MAX_ENERGY | 8 |
| MAX_SHIELD | 0 |
| MAX_MOVEMENT | 3 |
| Versión | 1 |
| Funciones de ataque | Máximo 2, solo V1 |

Son más rápidos que los Bots de los jugadores (MAX_MOVEMENT 3 vs 2 base) pero mucho más frágiles. Mueren en pocos golpes pero pueden acorralar si no se gestionan bien.

Cada tipo de ROGUE.EXE tiene su propio **flowchart de IA** detallado en la ficha del escenario correspondiente.

---


## Los 3 Escenarios del Acto II

### Escenario 4 — PURGE.PROTOCOL

**Objetivo:** Elimina todos los ROGUE.EXE antes de que completen 5 rondas.

Los ROGUE.EXE intentan llegar a un Hex objetivo en el centro del tablero. Si alguno lo alcanza, activa un protocolo de interferencia que da **1 BUG a todos los Bots de los jugadores**.

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 3 | No hay refuerzos |

**Condición de victoria:** Eliminar todos los ROGUE.EXE antes del inicio de la ronda 6.
**Condición de derrota:** Inicio de ronda 6 con algún ROGUE.EXE vivo.

---

### Escenario 5 — SIEGE.MODE

**Objetivo:** Defended una zona central durante 6 rondas.

Hay una zona de **3 Hexes contiguos** en el centro del tablero que los jugadores deben mantener libre de ROGUE.EXE. Los refuerzos aparecen en Hexes de borde predeterminados.

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 4 | 1 ROGUE.EXE cada 2 rondas |

**Condición de victoria:** Ningún ROGUE.EXE ocupa la zona al final de la ronda 6.
**Condición de derrota:** Un ROGUE.EXE ocupa la zona al final de cualquier ronda.

---

### Escenario 6 — CORE.HUNT

**Objetivo:** Elimina al ROGUE.EXE Líder antes de que escape.

Entre los ROGUE.EXE hay un **Líder** con stats mejorados que intenta escapar por un Hex de salida en el borde del tablero. Los demás ROGUE.EXE son distracción.

**Stats del Líder:**

| Variable | Valor |
|---|---|
| MAX_LIFE | 12 |
| MAX_ENERGY | 10 |
| MAX_MOVEMENT | 4 |

| ROGUE.EXE iniciales | Refuerzos |
|---|---|
| 5 (incluido el Líder) | 2 ROGUE.EXE al inicio de ronda 3 |

**Condición de victoria:** El Líder es destruido antes de alcanzar el Hex de salida.
**Condición de derrota:** El Líder alcanza el Hex de salida.

---

## Equilibrio entre corporaciones

Cada corporación tiene contadores naturales que crean un meta-juego estratégico:

| Corporación | Fuerte contra | Débil contra |
|---|---|---|
| HDG | ACS (predecible) | Obsidian (actúa antes del escaneo) |
| TIS | Obsidian (no depende de energía) | NovaLife (ventajas progresivas) |
| ACS | NovaLife (frágil a corto plazo) | HDG (desmonta su BattleScript) |
| NovaLife | TIS (supera en largo plazo) | ACS (combate directo) |
| Obsidian | HDG (paraliza sus scans) | TIS (simplemente no se detiene) |

---


## Final 1 — SYSTEM OVERRIDE

**Condición:** Un jugador termina con IDC 8–10 y el otro con IDC 0–4.

**Tipo de escenario final:** Ninguno — cierre narrativo directo.

Un Programador ha aplastado completamente al otro en todos los sentidos durante toda la campaña. La corporación ganadora no solo domina las 28ª Firmware Wars sino que absorbe a la corporación perdedora. El perdedor queda registrado como activo subordinado en los servidores del ganador.

No hay Escenario Final porque no hay nada que disputar. El resultado ya está escrito en los logs del sistema.

> *"Tu código no tenía fallos. Solo tenía víctimas."*

**¿Puede cambiar?** No. El desequilibrio es demasiado grande para que el último escenario lo revierta.

---

## Final 2 — MERGE PROTOCOL

**Condición:** Ambos jugadores terminan con IDC entre 4 y 6.

**Tipo de escenario final:** Cooperativo especial vs. enemigo común.

El equilibrio perfecto. Ninguna corporación ha podido imponerse a la otra durante toda la campaña. Las Grandes Tecnológicas observan el empate y proponen algo inédito: una fusión corporativa.

Pero antes de que la fusión se consuma, el sistema de arbitraje de las Firmware Wars — un Bot autónomo de última generación llamado **ARBITER.EXE** — detecta la anomalía y se activa para eliminar a ambos contendientes. Los dos Programadores deben derrotarlo juntos.

**ARBITER.EXE — Stats:**

| Variable | Valor |
|---|---|
| MAX_LIFE | 30 |
| MAX_ENERGY | 20 |
| MAX_SHIELD | 3 |
| MAX_MOVEMENT | 2 |
| Versión | 3 |

ARBITER.EXE tiene su propio flowchart de IA avanzado y funciones de V3. Actúa una vez por ronda después de que ambos jugadores hayan activado todos sus Bots.

**Condición de victoria:** Destruir ARBITER.EXE.
**Condición de derrota:** Ambos jugadores pierden todos sus Bots.

**¿Puede cambiar?** Sí. Si los jugadores fallan y son derrotados, el final se degrada a **HOSTILE TAKEOVER** — la fusión no se consuma y una de las corporaciones aprovecha el caos para imponerse.

---

## Final 3 — HOSTILE TAKEOVER

**Condición:** Un jugador termina con IDC 7–10 y el otro con IDC 5–7.

**Tipo de escenario final:** Versus con ventaja para el líder.

Un Programador domina pero no ha aplastado al rival. La corporación dominante gana las Firmware Wars pero la perdedora sobrevive, herida pero operativa. En la sombra, el perdedor empieza a compilar su venganza para las 29ª Firmware Wars.

El jugador con IDC más alto entra al Escenario Final con ventaja:
- Un Bot empieza con **+4 de `energy`** adicional.
- El jugador dominante tiene **Prioridad de CPU** en la primera ronda sin necesidad de PPT protocol.

**Condición de victoria:** Eliminar todos los Bots del rival.
**Condición de derrota:** Ser el último Programador sin Bots operativos.

**¿Puede cambiar?** Sí. Si el jugador con IDC inferior gana el Escenario Final, el final cambia a **MERGE PROTOCOL** — el equilibrio inesperado fuerza la negociación de fusión.

> *"Ganaste la guerra. Pero dejaste enemigos con electricidad en las venas."*

---

## Final 4 — BACKDOOR ALLIANCE

**Condición:** Ambos jugadores aceptaron la Alianza Secreta en el Acto III y ambos tenían IDC entre 3 y 7.

**Tipo de escenario final:** Cooperativo con objetivos secretos individuales.

Los dos Programadores han traicionado a sus corporaciones y se han aliado en secreto. Ganan las Firmware Wars de forma conjunta pero la victoria es una fachada: en realidad han instalado un backdoor en el sistema de las Grandes Tecnológicas.

Antes del escenario, la web revela a cada jugador su **objetivo secreto individual** sin que el otro lo vea. Los objetivos son compatibles pero no idénticos — ambos pueden cumplirse, o uno puede sabotear al otro.

Ejemplos de objetivos secretos (la web asigna uno a cada jugador):
- *"Instala el backdoor en el Nodo Central antes de que tu aliado lo alcance."*
- *"Sobrevive al escenario con al menos un Bot operativo."*
- *"Elimina más Bots enemigos que tu aliado."*

**Condición de victoria conjunta:** Ambos jugadores completan su objetivo secreto — el backdoor se instala y ambas corporaciones colapsan juntas.
**Condición de victoria individual:** Solo uno completa su objetivo — ese Programador escapa con el backdoor. El otro queda atrapado en el sistema.
**Condición de derrota:** Ninguno completa su objetivo.

> *"La partida no la ganó ninguno de los dos. La ganó el código que nadie vio ejecutarse."*

**¿Puede cambiar?** Sí, en función de los objetivos secretos — puede acabar en victoria conjunta, victoria individual, o derrota.

---

## Final 5 — KERNEL PANIC

**Condición:** Ambos jugadores terminan con IDC entre 0 y 4.

**Tipo de escenario final:** Ninguno — decisión de rescate o cierre narrativo.

Ambos Programadores han colapsado. Sus corporaciones los declaran activos defectuosos y los borran del sistema. Las Firmware Wars continúan sin ellos.

Antes de cerrar, la web presenta una **última Decisión Corporativa de emergencia**:

> *"Ambos sistemas han fallado. La Corporación os ofrece una última oportunidad: fusionaos o desapareced."*

| Decisión | Resultado |
|---|---|
| Ambos aceptan | Final cambia a **MERGE PROTOCOL** — se juega el escenario cooperativo |
| Uno acepta y el otro rechaza | KERNEL PANIC confirmado — cierre narrativo |
| Ambos rechazan | KERNEL PANIC confirmado — cierre narrativo |

Si KERNEL PANIC se confirma, no hay Escenario Final. Las Firmware Wars siguen sin ellos.

> *"Algunos programas no se terminan. Simplemente dejan de ejecutarse."*

**¿Puede cambiar?** Solo si ambos aceptan la fusión de emergencia.

---

## Resumen de escenarios finales

| Final | Escenario 10 | ¿Puede cambiar? | Cambia hacia |
|---|---|---|---|
| SYSTEM OVERRIDE | Sin escenario | No | — |
| MERGE PROTOCOL | Cooperativo vs ARBITER.EXE | Sí | HOSTILE TAKEOVER |
| HOSTILE TAKEOVER | Versus con ventaja | Sí | MERGE PROTOCOL |
| BACKDOOR ALLIANCE | Cooperativo con objetivos secretos | Sí | Victoria individual o derrota |
| KERNEL PANIC | Sin escenario (decisión de rescate) | Sí | MERGE PROTOCOL |
