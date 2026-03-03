# INIT.SYS: Introducción

## ¿Qué es Firmware Wars?

**Firmware Wars** es un juego de combate táctico por turnos de **2-3 jugadores** en el que cada participante asume el rol de un **Programador Senior**: un ingeniero de élite que diseña, despliega y opera unidades robóticas de combate llamadas **Bots**.

El objetivo es claro: superar a los Bots rivales mediante la combinación de estrategia, programación táctica y adaptación a la aleatoriedad del sistema. El campo de batalla es un entorno digitalizado de combate formado por unas casillas hexagonales llamadas **Hexes**. Las decisiones se toman turno a turno siguiendo un ciclo de fases inspirado en el ciclo de vida del software **Core Combat System**.

> La victoria se define por la superioridad algorítmica, la eficiencia de tu Firmware y la habilidad de tu código para adaptarse a los fallos del sistema.

---

## ¿Cómo se juega?

Cada turno, el Programador ejecuta el **CORE.CYCLE** en cada uno de sus Bots. Este consiste en una secuencia de fases que simula el proceso de compilación y ejecución de código en tiempo real.

Cada Bot difiere en estadísticas y Funciones. A medida que avanza la partida, los Bots evolucionan desbloqueando Operaciones, Funciones y capacidades más avanzadas.

---

/page

## Objetivo de la Partida

El objetivo vendrá determinado por el **Escenario** elegido. Si no se escoge un Escenario para jugar, el objetivo predeterminado es la **eliminación total**: destruye todos los Bots del equipo rival. El último Programador con unidades operativas gana la partida.

Los Bots quedan destruidos cuando su variable `life` se reduce a 0. Una unidad destruida no puede ser reparada ni reactivada.

---