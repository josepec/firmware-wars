# INIT.SYS: Introducción

/two-columns
## ¿Qué es Firmware Wars?

**Firmware Wars** es un juego de combate táctico por turnos de **2-3 jugadores** en el que cada participante asume el rol de un **Programador Senior**: un ingeniero de élite que diseña, despliega y opera unidades robóticas de combate llamadas **Bots**.

El objetivo es claro: superar a los Bots rivales mediante la combinación de estrategia, programación táctica y adaptación a la aleatoriedad del sistema. El campo de batalla es un entorno digitalizado de combate formado por unas casillas hexagonales llamadas **Hexes**. Las decisiones se toman turno a turno siguiendo un ciclo de fases inspirado en el ciclo de vida del software **Core Combat System**.

> La victoria se define por la superioridad algorítmica, la eficiencia de tu Firmware y la habilidad de tu código para adaptarse a los fallos del sistema.

---

## ¿Cómo se juega?

Cada turno, el Programador ejecuta el **CORE.CYCLE**: una secuencia de fases que simula el proceso de compilación y ejecución de código en tiempo real.

Inicio de ronda:
1. **`INIT()`** — Se determina el **orden de activación** de los Programadores. El turno rota entre jugadores (un Bot cada uno) hasta completar todos los Bots. Los Bots mejoran en las rondas 3 y 5.
2. **`BOOT()`** — El Bot arranca, recupera Energía, carga **Operaciones** aleatorias del sistema y limpia **efectos temporales**.

Ciclo del Bot Activo:
1. **`COMPILE()`** — El Programador ordena sus **Operaciones** y define qué **Funciones** ejecutará cada una.
2. **`RUN()`** — El código se ejecuta línea por línea. Los condicionales se resuelven con dados, la energía se consume, los ataques impactan.
3. **`DEBUG()`** — Mantenimiento opcional: Permite purgar **Bugs**, recuperar el sistema y reparar el núcleo.
4. **`END()`** — Se descartan Operaciones, se conserva la memoria y la energía. El turno pasa al siguiente Bot o termina la ronda. Si se cumplen las condiciones de victoria, termina la partida.

Los Bots creados difieren en estadísticas y Funciones. A medida que avanza la partida, los Bots evolucionan hasta su `version` 3, desbloqueando Operaciones, Funciones y capacidades más avanzadas.

---

## Objetivo de la Partida

El objetivo vendrá determinado por el **Escenario** elegido. Si no se escoge un Escenario para jugar, el objetivo predeterminado es la **eliminación total**: destruye todos los Bots del equipo rival. El último Programador con unidades operativas gana la partida.

Los Bots quedan destruidos cuando su variable `life` se reduce a 0. Una unidad destruida no puede ser reparada ni reactivada.

---
/end-columns