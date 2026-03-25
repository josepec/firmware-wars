# 08 — ENDINGS.MD — Los 5 Finales

## Cómo se determina el final

Al terminar el Acto III (escenario 9), la web calcula el IDC de ambos jugadores y determina hacia qué final se dirigen. El **Escenario Final** (escenario 10) varía según el desenlace — en algunos casos hay un escenario jugable, en otros la narrativa cierra sola.

> El final se revela a los jugadores a través de la web antes de jugar el escenario 10, si lo hay.

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
