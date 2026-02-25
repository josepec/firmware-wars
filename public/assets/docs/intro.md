# INIT.SYS: Inicialización del Sistema

## ¿Qué es Firmware Wars?

**Firmware Wars** es un juego de combate táctico por turnos para **2 o más jugadores** en el que cada participante asume el rol de un **Programador Senior**: un ingeniero de élite que diseña, despliega y opera unidades robóticas de combate llamadas **Bots**.

El objetivo es claro: superar a los Bots rivales mediante la combinación de estrategia, programación táctica y adaptación a la aleatoriedad del sistema. El campo de batalla es un entorno digitalizado de combate representado con **casillas hexagonales** (Hexes), y las decisiones se toman turno a turno siguiendo un ciclo de fases inspirado en el ciclo de vida del software real.

> La diferencia entre un Programador mediocre y uno de élite no es el hardware — es el código.

---

## ¿Cómo se juega?

Cada turno, el Programador ejecuta el **CORE.CYCLE**: una secuencia de fases que simula el proceso de compilación y ejecución de código en tiempo real.

1. **`BOOT()`** — El Bot arranca: recupera Energía, carga Operaciones aleatorias del sistema y limpia efectos temporales.
2. **`COMPILE()`** — El Programador ordena sus Operaciones y define qué Funciones ejecutará cada una.
3. **`RUN()`** — El código se ejecuta línea por línea. Los condicionales se resuelven con dados, la energía se consume, los ataques impactan.
4. **`DEBUG()`** — Mantenimiento opcional. Permite purgar Bugs, recuperar sistemas y reparar el núcleo.
5. **`END()`** — Se descartan Operaciones, se conserva la memoria y el turno pasa al siguiente.

Los Bots disponibles difieren en estadísticas, ataques especiales y habilidades pasivas. A medida que avanza la partida, los Bots pueden evolucionar mediante `upgrade()` hasta su **versión 3**, desbloqueando operaciones y capacidades más avanzadas.

---

## Objetivo de la Partida

El objetivo predeterminado es la **eliminación total**: destruye todos los Bots del equipo rival. El último Programador con unidades operativas gana la partida.

Los Bots quedan destruidos cuando su variable `life` llega a 0 o menos. Una unidad destruida no puede ser reparada ni reactivada.

---